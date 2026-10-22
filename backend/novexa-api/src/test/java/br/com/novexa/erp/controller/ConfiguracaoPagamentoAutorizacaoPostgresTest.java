package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.service.JwtService;
import br.com.novexa.erp.support.AutenticacaoTeste;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;

@EnabledIfSystemProperty(named = "novexa.test.pagamento-autorizacao.jdbc-url",
        matches = "jdbc:postgresql://(?:127\\.0\\.0\\.1|localhost):[0-9]+/novexa_payment_security_test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.jpa.open-in-view=false", "spring.jpa.show-sql=false",
        "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=60000",
        "supabase.url=http://127.0.0.1:9", "supabase.secret-key=synthetic-test-only", "supabase.bucket=local"
})
class ConfiguracaoPagamentoAutorizacaoPostgresTest {
    private static final String URL = "/financeiro/configuracoes-formas-pagamento";
    private static final String SCHEMA = "autorizacao_pagamento_" + UUID.randomUUID().toString().replace("-", "");
    private static final AtomicLong CPFS = new AtomicLong(70000000000L);

    @DynamicPropertySource
    static void postgres(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", () -> System.getProperty("novexa.test.pagamento-autorizacao.jdbc-url") + "?currentSchema=" + SCHEMA);
        p.add("spring.datasource.username", () -> "postgres");
        p.add("spring.datasource.password", () -> "");
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        p.add("spring.flyway.enabled", () -> "true");
        p.add("spring.flyway.schemas", () -> SCHEMA);
        p.add("spring.flyway.default-schema", () -> SCHEMA);
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
    EmpresaEntity empresa, outra;
    ContaFinanceiraEntity banco, destinoNovo;
    String admin;

    @BeforeEach
    void preparar() {
        empresa = empresa(); outra = empresa();
        banco = contas.saveAndFlush(new ContaFinanceiraEntity(empresa, "Banco original", TipoContaFinanceira.BANCO, BigDecimal.ZERO));
        destinoNovo = contas.saveAndFlush(new ContaFinanceiraEntity(empresa, "Banco novo", TipoContaFinanceira.BANCO, BigDecimal.ZERO));
        admin = token(empresa, PerfilUsuario.ADMIN);
    }

    @ParameterizedTest
    @EnumSource(PerfilUsuario.class)
    void criacaoEConsultasPorPerfil(PerfilUsuario perfil) throws Exception {
        String usuario = token(empresa, perfil);
        var resposta = requisicao(HttpMethod.POST, URL, usuario, pedido());
        boolean gerencial = perfil == PerfilUsuario.ADMIN || perfil == PerfilUsuario.GERENTE;
        assertThat(resposta.getStatusCode().value()).isEqualTo(gerencial ? 201 : 403);
        assertThat(quantidadeConfiguracoes()).isEqualTo(gerencial ? 1 : 0);
        long id = gerencial ? id(resposta) : criar();
        assertThat(requisicao(HttpMethod.GET, URL + "?situacao=ativas", usuario, null).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(requisicao(HttpMethod.GET, URL + "/" + id, usuario, null).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(requisicao(HttpMethod.GET, "/financeiro/formas-pagamento", usuario, null).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertSemMovimentoFinanceiro();
    }

    @ParameterizedTest
    @EnumSource(PerfilUsuario.class)
    void taxaPrazoDestinoEAtivacaoExigemPerfilGerencial(PerfilUsuario perfil) throws Exception {
        long id = criar(); String usuario = token(empresa, perfil);
        var original = configuracao(id);
        boolean gerencial = perfil == PerfilUsuario.ADMIN || perfil == PerfilUsuario.GERENTE;
        for (var mudanca : List.<Map<String, Object>>of(Map.of("taxaPercentual", 4), Map.of("prazoRecebimentoDias", 2),
                Map.of("contaFinanceiraDestinoId", destinoNovo.getId()), Map.of("ativo", false), Map.of("ativo", true))) {
            var corpo = pedido(); corpo.putAll(mudanca);
            var resposta = requisicao(HttpMethod.PUT, URL + "/" + id, usuario, corpo);
            assertThat(resposta.getStatusCode().value()).isEqualTo(gerencial ? 200 : 403);
            if (gerencial) {
                var recebido = json.readTree(resposta.getBody());
                assertThat(recebido.get("taxaPercentual").decimalValue()).isEqualByComparingTo(corpo.get("taxaPercentual").toString());
                assertThat(recebido.get("prazoRecebimentoDias").asInt()).isEqualTo(((Number) corpo.get("prazoRecebimentoDias")).intValue());
                assertThat(recebido.get("contaFinanceiraDestino").get("id").asLong()).isEqualTo(((Number) corpo.get("contaFinanceiraDestinoId")).longValue());
                assertThat(recebido.get("ativo").asBoolean()).isEqualTo((Boolean) corpo.get("ativo"));
            } else {
                assertThat(configuracao(id)).isEqualTo(original);
            }
        }
        assertThat(quantidadeConfiguracoes()).isEqualTo(1);
        assertSemMovimentoFinanceiro();
    }

    @ParameterizedTest
    @EnumSource(value = PerfilUsuario.class, names = {"ADMIN", "GERENTE"})
    void autorizacaoNaoPermiteAlterarOutraEmpresaOuUsarDestinoExterno(PerfilUsuario perfil) throws Exception {
        long id = criar(); var original = configuracao(id);
        String externo = token(outra, perfil);
        assertThat(requisicao(HttpMethod.GET, URL + "/" + id, externo, null).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(requisicao(HttpMethod.PUT, URL + "/" + id, externo, pedido()).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(requisicao(HttpMethod.POST, URL, externo, pedido()).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(configuracao(id)).isEqualTo(original);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM configuracoes_formas_pagamento_empresa WHERE empresa_id=?", Long.class, outra.getId())).isZero();
    }

    @Test
    void semAutenticacaoRecebe401SemAlterarDados() throws Exception {
        long id = criar(); var original = configuracao(id);
        for (var metodo : List.of(HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT)) {
            String caminho = metodo == HttpMethod.PUT ? URL + "/" + id : URL;
            assertThat(requisicao(metodo, caminho, null, metodo == HttpMethod.GET ? null : pedido()).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }
        assertThat(configuracao(id)).isEqualTo(original);
        assertThat(quantidadeConfiguracoes()).isEqualTo(1);
    }

    @ParameterizedTest
    @EnumSource(value = PerfilUsuario.class, names = {"OPERADOR", "USUARIO"})
    void perfilOperacionalSelecionaConfiguracaoEFaturaNoPdv(PerfilUsuario perfil) throws Exception {
        String usuario = token(empresa, perfil);
        var operador = usuarios.findById(jdbc.queryForObject("SELECT id FROM usuario WHERE empresa_id=? AND perfil=?", Long.class, empresa.getId(), perfil.name())).orElseThrow();
        var caixa = new CaixaEntity(); caixa.setEmpresa(empresa); caixa.setDescricao("Caixa operacional");
        var sessao = sessoes.saveAndFlush(new SessaoCaixaEntity(caixas.saveAndFlush(caixa), operador, BigDecimal.ZERO));
        var produto = new ProdutoEntity(); produto.setEmpresa(empresa); produto.setNome("Produto de teste");
        produto.setUnidadeMedida("UN"); produto.setPrecoVenda(BigDecimal.TEN); produto.setControlaEstoque(false);
        produto = produtos.saveAndFlush(produto);
        var configuracao = Map.<String, Object>of("formaPagamentoId", 1, "nomeExibicao", "Dinheiro", "ativo", true);
        var criada = requisicao(HttpMethod.POST, URL, admin, configuracao);
        assertThat(criada.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        long configId = id(criada);
        assertThat(requisicao(HttpMethod.GET, URL + "?situacao=ativas", usuario, null).getStatusCode()).isEqualTo(HttpStatus.OK);
        var venda = Map.of("chaveRequisicao", UUID.randomUUID(), "sessaoCaixaId", sessao.getId(), "desconto", 0, "totalEsperado", 10,
                "itens", List.of(Map.of("produtoId", produto.getId(), "quantidade", 1, "precoUnitarioEsperado", 10)),
                "pagamentos", List.of(Map.of("configuracaoFormaPagamentoId", configId, "valor", 10, "valorRecebido", 10)));
        var resposta = requisicao(HttpMethod.POST, "/vendas", usuario, venda);
        assertThat(resposta.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(json.readTree(resposta.getBody()).get("status").asText()).isEqualTo("FATURADA");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM vendas WHERE empresa_id=? AND status='FATURADA' AND data_faturamento IS NOT NULL", Long.class, empresa.getId())).isEqualTo(1L);
    }

    private EmpresaEntity empresa() {
        var e = new EmpresaEntity(); e.setRazaoSocial("Empresa sintética"); e.setAtivo(true);
        return empresas.saveAndFlush(e);
    }
    private String token(EmpresaEntity e, PerfilUsuario perfil) {
        return AutenticacaoTeste.token(usuarios, jwt, e, perfil, Long.toString(CPFS.incrementAndGet()));
    }
    private Map<String, Object> pedido() {
        return new LinkedHashMap<>(Map.of("formaPagamentoId", 4, "nomeExibicao", "Crédito", "ativo", true,
                "contaFinanceiraDestinoId", banco.getId(), "taxaPercentual", 3, "taxaFixa", 0, "prazoRecebimentoDias", 1));
    }
    private ResponseEntity<String> requisicao(HttpMethod metodo, String caminho, String token, Object corpo) {
        var headers = new HttpHeaders(); headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) headers.set(HttpHeaders.AUTHORIZATION, token);
        return http.exchange(caminho, metodo, new HttpEntity<>(corpo, headers), String.class);
    }
    private long criar() throws Exception {
        var resposta = requisicao(HttpMethod.POST, URL, admin, pedido());
        assertThat(resposta.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return id(resposta);
    }
    private long id(ResponseEntity<String> resposta) throws Exception { return json.readTree(resposta.getBody()).get("id").asLong(); }
    private long quantidadeConfiguracoes() { return jdbc.queryForObject("SELECT count(*) FROM configuracoes_formas_pagamento_empresa WHERE empresa_id=?", Long.class, empresa.getId()); }
    private Map<String, Object> configuracao(long id) { return jdbc.queryForMap("SELECT * FROM configuracoes_formas_pagamento_empresa WHERE id=? AND empresa_id=?", id, empresa.getId()); }
    private void assertSemMovimentoFinanceiro() {
        assertThat(jdbc.queryForObject("SELECT count(*) FROM movimentacoes_financeiras WHERE empresa_id=?", Long.class, empresa.getId())).isZero();
        assertThat(jdbc.queryForObject("SELECT sum(saldo_atual) FROM contas_financeiras WHERE empresa_id=?", BigDecimal.class, empresa.getId())).isEqualByComparingTo("0");
    }
}
