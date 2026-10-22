package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.PagamentoVendaRequestDTO;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.service.JwtService;
import br.com.novexa.erp.service.LiquidacaoRecebivelService;
import br.com.novexa.erp.support.AutenticacaoTeste;
import br.com.novexa.erp.time.TempoNovexa;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "novexa.test.parcelamento.jdbc-url",
        matches = "jdbc:postgresql://(?:127\\.0\\.0\\.1|localhost):[0-9]+/novexa_card_installments_test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.jpa.open-in-view=false", "spring.jpa.show-sql=false",
        "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=600000",
        "supabase.url=http://127.0.0.1:9", "supabase.secret-key=synthetic-test-only", "supabase.bucket=local"
})
class ParcelamentoConsumidorPostgresTest {
    static final String URL = System.getProperty("novexa.test.parcelamento.jdbc-url");
    static final String SCHEMA = "parcelamento_" + UUID.randomUUID().toString().replace("-", "");
    static final String CONFIG = "/financeiro/configuracoes-formas-pagamento";
    static final AtomicLong CPFS = new AtomicLong(72000000000L);
    @DynamicPropertySource static void postgres(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", () -> URL + "?currentSchema=" + SCHEMA);
        p.add("spring.datasource.username", () -> "postgres"); p.add("spring.datasource.password", () -> "");
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.jpa.hibernate.ddl-auto", () -> "validate"); p.add("spring.flyway.enabled", () -> "true");
        p.add("spring.flyway.schemas", () -> SCHEMA); p.add("spring.flyway.default-schema", () -> SCHEMA);
    }
    @Autowired TestRestTemplate http;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired ContaFinanceiraRepository contas;
    @Autowired CaixaRepository caixas;
    @Autowired SessaoCaixaRepository sessoes;
    @Autowired ProdutoRepository produtos;
    @Autowired JwtService jwt;
    @Autowired LiquidacaoRecebivelService liquidacao;
    EmpresaEntity empresa;
    ContaFinanceiraEntity banco;
    String admin, operador;
    long sessao, produto;

    @BeforeEach void preparar() {
        empresa = empresa();
        banco = contas.saveAndFlush(new ContaFinanceiraEntity(empresa, "Banco sintético", TipoContaFinanceira.BANCO, BigDecimal.ZERO));
        admin = token(empresa, PerfilUsuario.ADMIN); operador = token(empresa, PerfilUsuario.OPERADOR);
        var usuario = usuarios.findById(jdbc.queryForObject("select id from usuario where empresa_id=? and perfil='OPERADOR'", Long.class, empresa.getId())).orElseThrow();
        var caixa = new CaixaEntity(); caixa.setEmpresa(empresa); caixa.setDescricao("Caixa de teste");
        sessao = sessoes.saveAndFlush(new SessaoCaixaEntity(caixas.saveAndFlush(caixa), usuario, BigDecimal.ZERO)).getId();
        var p = new ProdutoEntity(); p.setEmpresa(empresa); p.setNome("Mercadoria"); p.setUnidadeMedida("UN");
        p.setPrecoVenda(new BigDecimal("300")); p.setControlaEstoque(false); produto = produtos.saveAndFlush(p).getId();
    }

    @ParameterizedTest @ValueSource(ints = {1, 3})
    void creditoD0CreditaLiquidoIntegralUmaUnicaVez(int parcelas) throws Exception {
        long config = criar(4, 3, 0);
        var pedido = venda(List.of(parte(config, 300, parcelas)));
        var resposta = req(HttpMethod.POST, "/vendas", operador, pedido); status(resposta, 201);
        long venda = id(resposta); pagamento(venda, parcelas, "SIMPLIFICADO");
        assertThat(jdbc.queryForObject("select total from vendas where id=?", BigDecimal.class, venda)).isEqualByComparingTo("300");
        assertThat(jdbc.queryForObject("select data_faturamento is not null from vendas where id=?", Boolean.class, venda)).isTrue();
        recebivel(venda, "LIQUIDADO", "300", "9", "291", 0);
        saldo("291"); movimentos(1);
        var retry = req(HttpMethod.POST, "/vendas", operador, pedido); assertThat(retry.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(id(retry)).isEqualTo(venda); saldo("291"); movimentos(1);
        pedido.put("pagamentos", List.of(parte(config, 300, parcelas == 3 ? 2 : 3)));
        status(req(HttpMethod.POST, "/vendas", operador, pedido), 409); saldo("291"); movimentos(1);
        System.out.println("PARCELAMENTO D+0: crédito " + parcelas + "x, bruto=300.00, taxa=9.00, líquido=291.00, recebíveis=1, movimentos=1");
    }

    @Test void alteracaoPosteriorNaoReinterpretaSnapshotsNemEstorno() throws Exception {
        long config = criar(4, 3, 0);
        var pedido = venda(List.of(parte(config, 300, 3)));
        var resposta = req(HttpMethod.POST, "/vendas", operador, pedido); status(resposta, 201); long venda = id(resposta);
        var historico = jdbc.queryForMap("select * from pagamentos where venda_id=?", venda);
        var recebivel = jdbc.queryForMap("select * from recebiveis where venda_id=?", venda);
        var destino = contas.saveAndFlush(new ContaFinanceiraEntity(empresa, "Outro banco", TipoContaFinanceira.BANCO, BigDecimal.ZERO));
        var mudanca = configuracao(4, 1, 30); mudanca.put("taxaPercentual", 8); mudanca.put("contaFinanceiraDestinoId", destino.getId());
        status(req(HttpMethod.PUT, CONFIG + "/" + config, admin, mudanca), 200);
        var retry = req(HttpMethod.POST, "/vendas", operador, pedido); assertThat(retry.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(id(retry)).isEqualTo(venda);
        assertThat(jdbc.queryForMap("select * from pagamentos where venda_id=?", venda)).isEqualTo(historico);
        assertThat(jdbc.queryForMap("select * from recebiveis where venda_id=?", venda)).isEqualTo(recebivel);
        status(req(HttpMethod.POST, "/vendas/" + venda + "/cancelar", admin, null), 200);
        saldo("0"); movimentos(1); pagamento(venda, 3, "SIMPLIFICADO");
        assertThat(jdbc.queryForObject("select estornada from movimentacoes_financeiras where empresa_id=?", Boolean.class, empresa.getId())).isTrue();
        assertThat(jdbc.queryForObject("select status from recebiveis where venda_id=?", String.class, venda)).isEqualTo("CANCELADO");
        assertThat(jdbc.queryForObject("select saldo_atual from contas_financeiras where id=?", BigDecimal.class, destino.getId())).isEqualByComparingTo("0");
    }

    @Test void creditoTresVezesD1MantemPrevisaoIntegralEConcorrenciaNaoDuplicaLiquidacao() throws Exception {
        long config = criar(4, 3, 1);
        var resposta = req(HttpMethod.POST, "/vendas", operador, venda(List.of(parte(config, 300, 3)))); status(resposta, 201);
        long venda = id(resposta); recebivel(venda, "PENDENTE", "300", "9", "291", 1); saldo("0"); movimentos(0);
        long id = jdbc.queryForObject("select id from recebiveis where venda_id=?", Long.class, venda);
        assertThatThrownBy(() -> liquidacao.liquidarAutomaticamente(id, empresa.getId())).hasMessageContaining("ainda não elegível");
        saldo("0"); movimentos(0);
        String gerente = token(empresa, PerfilUsuario.GERENTE);
        var pool = Executors.newFixedThreadPool(8); var inicio = new CountDownLatch(1);
        try {
            var tarefas = new ArrayList<Future<ResponseEntity<String>>>();
            for (int i = 0; i < 8; i++) {
                String usuario = i % 2 == 0 ? admin : gerente;
                tarefas.add(pool.submit(() -> { inicio.await(); return req(HttpMethod.POST, "/financeiro/recebiveis/" + id + "/liquidar", usuario, null); }));
            }
            inicio.countDown();
            for (var tarefa : tarefas) status(tarefa.get(30, TimeUnit.SECONDS), 200);
        } finally { inicio.countDown(); pool.shutdownNow(); pool.awaitTermination(5, TimeUnit.SECONDS); }
        recebivel(venda, "LIQUIDADO", "300", "9", "291", 1); saldo("291"); movimentos(1); pagamento(venda, 3, "SIMPLIFICADO");
    }

    @Test void controladoPreservaRecebivelPendenteEPermiteCancelamentoAntesDaLiquidacao() throws Exception {
        empresa.configurarRecebimentos(ModoRecebimentoFinanceiro.CONTROLADO, ModoConferenciaFechamento.POR_FORMA_PAGAMENTO, true);
        empresas.saveAndFlush(empresa); long config = criar(4, 3, 0);
        var resposta = req(HttpMethod.POST, "/vendas", operador, venda(List.of(parte(config, 300, 3)))); status(resposta, 201);
        long venda = id(resposta); recebivel(venda, "PENDENTE", "300", "9", "291", 0); saldo("0"); movimentos(0);
        pagamento(venda, 3, "CONTROLADO");
        status(req(HttpMethod.POST, "/vendas/" + venda + "/cancelar", admin, null), 200); saldo("0"); movimentos(0);
        assertThat(jdbc.queryForObject("select status from recebiveis where venda_id=?", String.class, venda)).isEqualTo("CANCELADO");
    }

    @Test void mistoPreservaPixDinheiroEDebitoSemParcelarRecebiveis() throws Exception {
        long credito = criar(4, 3, 0), debito = criar(3, null, 0), pix = criar(2, null, 0), dinheiro = criar(1, null, 0);
        var resposta = req(HttpMethod.POST, "/vendas", operador, venda(List.of(parte(credito, 150, 3), parte(debito, 50, null), parte(pix, 50, null), parte(dinheiro, 50, null))));
        status(resposta, 201); long venda = id(resposta);
        assertThat(jdbc.queryForObject("select count(*) from pagamentos where venda_id=?", Integer.class, venda)).isEqualTo(4);
        assertThat(jdbc.queryForObject("select count(*) from recebiveis where venda_id=?", Integer.class, venda)).isEqualTo(2);
        saldo("244"); movimentos(3);
        assertThat(jdbc.queryForObject("select sum(valor) from movimentacoes_caixa where sessao_id=? and tipo='VENDA'", BigDecimal.class, sessao)).isEqualByComparingTo("50");
        assertThat(jdbc.queryForList("select parcelas_consumidor from pagamentos where venda_id=? and forma_pagamento<>'CARTAO_CREDITO'", Integer.class, venda)).containsOnlyNulls();
    }

    @Test void rejeitaLimitesFracoesEParcelamentoNaoCreditoSemEfeitos() throws Exception {
        long credito = criar(4, 3, 0), debito = criar(3, null, 0), dinheiro = criar(1, null, 0);
        for (Object parcelas : List.of(0, -1, 13, 120, 1.5, "3", 3.0))
            status(req(HttpMethod.POST, "/vendas", operador, venda(List.of(parte(credito, 300, parcelas)))), 400);
        status(req(HttpMethod.POST, "/vendas", operador, venda(List.of(parte(credito, 300, 4)))), 409);
        for (long config : List.of(debito, dinheiro))
            status(req(HttpMethod.POST, "/vendas", operador, venda(List.of(parte(config, 300, 3)))), 400);
        for (Object maximo : List.of(0, -1, 13, 120, 2.5, "3", 3.0)) {
            var p = configuracao(4, 1, 0); p.put("maximoParcelasConsumidor", maximo); status(req(HttpMethod.POST, CONFIG, admin, p), 400);
        }
        status(req(HttpMethod.POST, CONFIG, admin, configuracao(3, 3, 0)), 400);
        status(req(HttpMethod.POST, CONFIG, admin, configuracao(2, 3, 0)), 400);
        assertThat(jdbc.queryForObject("select count(*) from vendas where empresa_id=?", Integer.class, empresa.getId())).isZero(); saldo("0"); movimentos(0);
    }

    @ParameterizedTest @EnumSource(PerfilUsuario.class)
    void limiteEmpresarialReutilizaAutorizacao10A(PerfilUsuario perfil) throws Exception {
        String token = token(empresa, perfil); boolean permitido = perfil == PerfilUsuario.ADMIN || perfil == PerfilUsuario.GERENTE;
        status(req(HttpMethod.POST, CONFIG, token, configuracao(4, 6, 0)), permitido ? 201 : 403);
        long id = criar(4, 3, 0);
        status(req(HttpMethod.PUT, CONFIG + "/" + id, token, configuracao(4, 6, 0)), permitido ? 200 : 403);
        var leitura = req(HttpMethod.GET, CONFIG + "/" + id, token, null); status(leitura, 200);
        assertThat(json.readTree(leitura.getBody()).get("maximoParcelasConsumidor").asInt()).isEqualTo(permitido ? 6 : 3);
        status(req(HttpMethod.PUT, CONFIG + "/" + id, admin, configuracao(4, null, 0)), 200);
        assertThat(jdbc.queryForObject("select maximo_parcelas_consumidor from configuracoes_formas_pagamento_empresa where id=?", Integer.class, id)).isEqualTo(permitido ? 6 : 3);
    }

    @Test void empresasPossuemLimitesIndependentesEIdsExternosRetornam404() throws Exception {
        long id = criar(4, 3, 0); var outra = empresa(); String externo = token(outra, PerfilUsuario.ADMIN);
        var outraConta = contas.saveAndFlush(new ContaFinanceiraEntity(outra, "Banco externo", TipoContaFinanceira.BANCO, BigDecimal.ZERO));
        var config = configuracao(4, 6, 0); config.put("contaFinanceiraDestinoId", outraConta.getId());
        var criada = req(HttpMethod.POST, CONFIG, externo, config); status(criada, 201);
        status(req(HttpMethod.PUT, CONFIG + "/" + id, externo, config), 404);
        status(req(HttpMethod.GET, CONFIG + "/" + id, externo, null), 404);
        status(req(HttpMethod.POST, "/vendas", operador, venda(List.of(parte(id(criada), 300, 3)))), 404);
        assertThat(jdbc.queryForObject("select maximo_parcelas_consumidor from configuracoes_formas_pagamento_empresa where id=?", Integer.class, id)).isEqualTo(3);
        status(req(HttpMethod.POST, "/vendas", operador, venda(List.of(parte(id, 300, 6)))), 409);
        assertThat(jdbc.queryForObject("select count(*) from vendas where empresa_id=?", Integer.class, empresa.getId())).isZero();
    }

    @Test void omissaoEUmPreservamHashAntigoEConfiguracaoLegadaPermiteSomenteUm() throws Exception {
        var antigo = new PagamentoVendaRequestDTO(42L, new BigDecimal("300"), null);
        assertThat(antigo.toString()).isEqualTo("PagamentoVendaRequestDTO[configuracaoFormaPagamentoId=42, valor=300, valorRecebido=null]");
        assertThat(new PagamentoVendaRequestDTO(42L, new BigDecimal("300"), null, 1).toString()).isEqualTo(antigo.toString());
        long config = criar(4, null, 0);
        jdbc.update("update configuracoes_formas_pagamento_empresa set maximo_parcelas_consumidor=null where id=?", config);
        status(req(HttpMethod.POST, "/vendas", operador, venda(List.of(parte(config, 300, 3)))), 409);
        var parte = parte(config, 300, null); var pedido = venda(List.of(parte));
        var resposta = req(HttpMethod.POST, "/vendas", operador, pedido); status(resposta, 201); pagamento(id(resposta), 1, "SIMPLIFICADO");
        parte.put("parcelasConsumidor", 1);
        var retry = req(HttpMethod.POST, "/vendas", operador, pedido); assertThat(retry.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(id(retry)).isEqualTo(id(resposta)); saldo("291"); movimentos(1);
    }

    @Test void upgradeV57PreservaDadosLegadosEConstraints() {
        String schema = "upgrade_parcelamento_" + UUID.randomUUID().toString().replace("-", "");
        Flyway.configure().dataSource(URL, "postgres", "").schemas(schema).defaultSchema(schema).target("57").load().migrate();
        var db = new JdbcTemplate(new DriverManagerDataSource(URL + "?currentSchema=" + schema, "postgres", ""));
        db.update("insert into empresas(id,razao_social,ativo) values (1,'Legado',true)");
        db.update("insert into usuario(id,empresa_id,nome_usuario,cpf,ativo,perfil) values (1,1,'Legado','72000000001',true,'ADMIN')");
        db.update("insert into configuracoes_formas_pagamento_empresa(empresa_id,forma_pagamento_id,tipo,nome_exibicao,ativo,data_criacao,data_atualizacao) values (1,1,'DINHEIRO','Legado',true,now(),now())");
        db.update("insert into vendas(id,empresa_id,usuario_id,chave_requisicao,resumo_requisicao,data_hora,status,subtotal,desconto,total,forma_pagamento,valor_recebido,troco) values (1,1,1,?,'legado',now(),'FATURADA',300,0,300,'CARTAO_CREDITO',300,0)", UUID.randomUUID());
        db.update("insert into pagamentos(empresa_id,venda_id,usuario_id,sequencia,chave_requisicao,forma_pagamento,forma_pagamento_id,valor,status,data_hora,taxa_percentual_snapshot,taxa_fixa_snapshot,prazo_recebimento_dias_snapshot) values (1,1,1,1,?,'CARTAO_CREDITO',4,300,'REGISTRADO',now(),3,0,0)", UUID.randomUUID());
        var antigo = db.queryForMap("select * from pagamentos");
        var configuracao = db.queryForMap("select * from configuracoes_formas_pagamento_empresa");
        var atualizado = Flyway.configure().dataSource(URL, "postgres", "").schemas(schema).defaultSchema(schema).load();
        atualizado.migrate(); atualizado.validate(); assertThat(atualizado.info().pending()).isEmpty();
        var pagamento = db.queryForMap("select * from pagamentos");
        assertThat(pagamento.remove("parcelas_consumidor")).isNull(); assertThat(pagamento).isEqualTo(antigo);
        var cfg = db.queryForMap("select * from configuracoes_formas_pagamento_empresa");
        assertThat(cfg.remove("maximo_parcelas_consumidor")).isNull(); assertThat(cfg).isEqualTo(configuracao);
        assertThatThrownBy(() -> db.update("update pagamentos set parcelas_consumidor=13")).hasMessageContaining("chk_pag_parcelas_consumidor");
        assertThatThrownBy(() -> db.update("update configuracoes_formas_pagamento_empresa set maximo_parcelas_consumidor=3")).hasMessageContaining("chk_cfg_max_parcelas_consumidor");
        db.update("update pagamentos set forma_pagamento='CARTAO_DEBITO',forma_pagamento_id=3");
        assertThatThrownBy(() -> db.update("update pagamentos set parcelas_consumidor=3")).hasMessageContaining("chk_pag_parcelas_consumidor");
    }

    private EmpresaEntity empresa() {
        var e = new EmpresaEntity(); e.setRazaoSocial("Parcelamento sintético"); e.setAtivo(true);
        e.configurarRecebimentos(ModoRecebimentoFinanceiro.SIMPLIFICADO, ModoConferenciaFechamento.POR_FORMA_PAGAMENTO, true);
        return empresas.saveAndFlush(e);
    }
    private String token(EmpresaEntity e, PerfilUsuario perfil) { return AutenticacaoTeste.token(usuarios, jwt, e, perfil, Long.toString(CPFS.incrementAndGet())); }
    private Map<String, Object> configuracao(int forma, Integer maximo, int prazo) {
        var p = new LinkedHashMap<String, Object>(); p.put("formaPagamentoId", forma); p.put("nomeExibicao", "Forma " + UUID.randomUUID()); p.put("ativo", true);
        if (maximo != null) p.put("maximoParcelasConsumidor", maximo);
        if (forma != 1) p.put("contaFinanceiraDestinoId", banco.getId());
        if (forma == 3 || forma == 4) { p.put("taxaPercentual", 3); p.put("taxaFixa", 0); p.put("prazoRecebimentoDias", prazo); }
        return p;
    }
    private long criar(int forma, Integer maximo, int prazo) throws Exception { var r = req(HttpMethod.POST, CONFIG, admin, configuracao(forma, maximo, prazo)); status(r, 201); return id(r); }
    private Map<String, Object> parte(long config, int valor, Object parcelas) {
        var p = new LinkedHashMap<String, Object>(Map.of("configuracaoFormaPagamentoId", config, "valor", valor));
        if (parcelas != null) p.put("parcelasConsumidor", parcelas); return p;
    }
    private Map<String, Object> venda(List<Map<String, Object>> partes) {
        return new LinkedHashMap<>(Map.of("chaveRequisicao", UUID.randomUUID(), "sessaoCaixaId", sessao, "desconto", 0, "totalEsperado", 300,
                "itens", List.of(Map.of("produtoId", produto, "quantidade", 1, "precoUnitarioEsperado", 300)), "pagamentos", partes));
    }
    private ResponseEntity<String> req(HttpMethod metodo, String path, String token, Object corpo) {
        var headers = new HttpHeaders(); headers.setContentType(MediaType.APPLICATION_JSON); headers.set(HttpHeaders.AUTHORIZATION, token);
        return http.exchange(path, metodo, new HttpEntity<>(corpo, headers), String.class);
    }
    private void status(ResponseEntity<String> r, int status) { assertThat(r.getStatusCode().value()).as(r.getBody()).isEqualTo(status); }
    private long id(ResponseEntity<String> r) throws Exception { return json.readTree(r.getBody()).get("id").asLong(); }
    private void saldo(String valor) { assertThat(jdbc.queryForObject("select saldo_atual from contas_financeiras where id=?", BigDecimal.class, banco.getId())).isEqualByComparingTo(valor); }
    private void movimentos(int quantidade) { assertThat(jdbc.queryForObject("select count(*) from movimentacoes_financeiras where empresa_id=?", Integer.class, empresa.getId())).isEqualTo(quantidade); }
    private void pagamento(long venda, int parcelas, String modo) throws Exception {
        var r = req(HttpMethod.GET, "/vendas/" + venda + "/pagamentos", operador, null); status(r, 200);
        var p = json.readTree(r.getBody()); assertThat(p.size()).isEqualTo(1);
        assertThat(p.get(0).get("parcelasConsumidor").asInt()).isEqualTo(parcelas);
        assertThat(p.get(0).get("modoRecebimentoSnapshot").asText()).isEqualTo(modo);
    }
    private void recebivel(long venda, String status, String bruto, String taxa, String liquido, int prazo) {
        var r = jdbc.queryForMap("select * from recebiveis where venda_id=?", venda);
        assertThat(r.get("status")).isEqualTo(status); assertThat(r.get("numero_parcela")).isEqualTo(1); assertThat(r.get("total_parcelas")).isEqualTo(1);
        assertThat((BigDecimal) r.get("valor_bruto")).isEqualByComparingTo(bruto);
        assertThat((BigDecimal) r.get("valor_taxas_previsto")).isEqualByComparingTo(taxa);
        assertThat((BigDecimal) r.get("valor_liquido_previsto")).isEqualByComparingTo(liquido);
        assertThat(r.get("data_prevista_recebimento").toString()).isEqualTo(((java.sql.Timestamp) r.get("data_venda")).toLocalDateTime().toLocalDate().plusDays(prazo).toString());
        if (status.equals("LIQUIDADO")) assertThat((BigDecimal) r.get("valor_liquido_recebido")).isEqualByComparingTo(liquido);
        else assertThat(r.get("data_liquidacao")).isNull();
    }
}
