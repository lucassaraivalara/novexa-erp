package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.service.JwtService;
import br.com.novexa.erp.time.TempoNovexa;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.assertj.core.api.Assertions.assertThat;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@EnabledIfSystemProperty(named = "novexa.test.analise.jdbc-url", matches = "jdbc:postgresql://(?:localhost|127\\.0\\.0\\.1):.*")
@SpringBootTest(properties = {"spring.jpa.open-in-view=false", "spring.jpa.show-sql=false",
        "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=60000",
        "supabase.url=http://127.0.0.1:9", "supabase.secret-key=synthetic-test-only", "supabase.bucket=local"})
@AutoConfigureMockMvc
@Transactional
class AnaliseVendasPostgresTest {
    private static final String SCHEMA = "analise_" + UUID.randomUUID().toString().replace("-", "");
    @DynamicPropertySource static void postgres(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", () -> System.getProperty("novexa.test.analise.jdbc-url") + "?currentSchema=" + SCHEMA);
        p.add("spring.datasource.username", () -> "novexa_analise_test");
        p.add("spring.datasource.password", () -> "");
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        p.add("spring.flyway.enabled", () -> "true");
        p.add("spring.flyway.default-schema", () -> SCHEMA);
        p.add("spring.flyway.schemas", () -> SCHEMA);
    }
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired VendaRepository vendas;
    @Autowired ProdutoRepository produtos;
    @Autowired ItemVendaRepository itens;
    @Autowired JwtService jwt;
    @Autowired Flyway flyway;
    @Autowired CaixaRepository caixas;
    @Autowired SessaoCaixaRepository sessoes;
    @Autowired ClienteRepository clientes;
    @Autowired jakarta.persistence.EntityManager em;
    @Autowired com.fasterxml.jackson.databind.ObjectMapper json;
    @Autowired CategoriaProdutoRepository categorias;
    @Autowired FormaPagamentoRepository formas;
    @Autowired PagamentoRepository pagamentos;
    EmpresaEntity empresa, outra;
    UsuarioEntity admin;
    String token;
    MockedStatic<TempoNovexa> tempo;

    @BeforeEach void preparar() {
        empresa = empresa("Empresa análise", "11222333000181");
        outra = empresa("Outro tenant", "99888777000166");
        admin = usuario(empresa, "52998224725", PerfilUsuario.ADMIN);
        token = "Bearer " + jwt.gerarToken(admin);
        tempo = Mockito.mockStatic(TempoNovexa.class, Mockito.CALLS_REAL_METHODS);
        tempo.when(TempoNovexa::hoje).thenReturn(LocalDate.of(2026, 10, 22));
        tempo.when(TempoNovexa::agora).thenReturn(LocalDateTime.of(2026, 10, 22, 14, 3));
    }
    @AfterEach void encerrar() { if (tempo != null) tempo.close(); }

    @Test void resumoUsaTodosOsFaturadosDoTenantSemConfundirRecebimento() throws Exception {
        venda(admin, "2026-10-21T23:59:59", "100.00", "10.00", StatusVenda.FATURADA);
        venda(admin, "2026-10-22T00:00:00", "50.00", "5.00", StatusVenda.FATURADA);
        venda(admin, "2026-10-22T14:03:00", "900.00", "0", StatusVenda.ABERTA);
        venda(admin, "2026-10-22T14:03:00", "800.00", "0", StatusVenda.CANCELADA);
        venda(usuario(outra, "11144477735", PerfilUsuario.ADMIN), "2026-10-22T12:00:00", "700", "0", StatusVenda.FATURADA);
        consulta("2026-10-21", "2026-10-22")
                .andExpect(status().isOk()).andExpect(jsonPath("$.atual.faturamento").value(150))
                .andExpect(jsonPath("$.atual.quantidadeVendas").value(2))
                .andExpect(jsonPath("$.atual.ticketMedio").value(75))
                .andExpect(jsonPath("$.atual.descontos").value(15))
                .andExpect(jsonPath("$.periodo.incompleto").value(true));
        consulta("2026-10-22", "2026-10-22").andExpect(jsonPath("$.atual.faturamento").value(50));
        flyway.validate();
    }

    @Test void semVendasRetornaZerosEPeriodoInvalidoERejeitado() throws Exception {
        consulta("2026-10-01", "2026-10-02").andExpect(status().isOk())
                .andExpect(jsonPath("$.atual.faturamento").value(0)).andExpect(jsonPath("$.atual.ticketMedio").value(0));
        for (String[] intervalo : new String[][]{{"2026-10-22", "2026-10-21"}, {"2026-10-22", "2026-10-23"}, {"2024-01-01", "2026-10-22"}})
            consulta(intervalo[0], intervalo[1]).andExpect(status().isBadRequest());
        mvc.perform(get("/vendas/analise/resumo").header("Authorization", token)).andExpect(status().isBadRequest());
    }

    @Test void exigePerfilGerencialNoBackendEIgnoraEmpresaDoCliente() throws Exception {
        for (var perfil : PerfilUsuario.values()) {
            admin.setPerfil(perfil); usuarios.saveAndFlush(admin);
            mvc.perform(get("/vendas/analise/resumo").param("dataInicial", "2026-10-22").param("dataFinal", "2026-10-22")
                    .param("empresaId", outra.getId().toString()).header("Authorization", "Bearer " + jwt.gerarToken(admin)))
                    .andExpect(status().is(perfil == PerfilUsuario.ADMIN || perfil == PerfilUsuario.GERENTE ? 200 : 403));
        }
        mvc.perform(get("/vendas/analise/resumo")).andExpect(status().isUnauthorized());
    }

    @Test void comparaIntervaloAnteriorIgualPreencheDiasSemVendaEZerosNaViradaDoDia() throws Exception {
        venda(admin, "2026-10-19T23:59:59", "30", "0", StatusVenda.FATURADA);
        venda(admin, "2026-10-20T23:59:59", "70", "0", StatusVenda.FATURADA);
        venda(admin, "2026-10-21T00:00:00", "80", "0", StatusVenda.FATURADA);
        consulta("2026-10-21", "2026-10-22").andExpect(status().isOk())
                .andExpect(jsonPath("$.periodoAnterior.dataInicial").value("2026-10-19"))
                .andExpect(jsonPath("$.periodoAnterior.dataFinal").value("2026-10-20"))
                .andExpect(jsonPath("$.anterior.faturamento").value(100))
                .andExpect(jsonPath("$.evolucao.length()").value(2))
                .andExpect(jsonPath("$.evolucao[0].faturamento").value(80))
                .andExpect(jsonPath("$.evolucao[1].faturamento").value(0))
                .andExpect(jsonPath("$.evolucaoAnterior[1].faturamento").value(70));
        consulta("2026-09-01", "2026-09-07").andExpect(jsonPath("$.anterior.faturamento").value(0))
                .andExpect(jsonPath("$.evolucao.length()").value(7));
    }

    @Test void rateioDeCentavosReconciliadoEEstavelComCategoriaAtualENomeHistorico() throws Exception {
        var c = categorias.saveAndFlush(new CategoriaProdutoEntity(empresa, "Bebidas", true));
        var a = produto("Primeiro histórico", "UN", c);
        var b = produto("Segundo", "UN", null);
        var z = produto("Terceiro", "UN", c);
        var v = venda(admin, "2026-10-22T12:00:00", "0.02", "0.01", StatusVenda.FATURADA);
        item(v, a, "1", "0.01", 1); item(v, b, "1", "0.01", 2); item(v, z, "1", "0.01", 3);
        a.setNome("Nome atual diferente"); produtos.saveAndFlush(a);
        endpoint("produtos").andExpect(status().isOk()).andExpect(jsonPath("$.pagina.totalItems").value(3))
                .andExpect(jsonPath("$.pagina.items[0].nome").value("Primeiro histórico"))
                .andExpect(jsonPath("$.pagina.items[0].valorVendido").value(0.01))
                .andExpect(jsonPath("$.pagina.items[0].participacao").value(50))
                .andExpect(jsonPath("$.pagina.items[1].valorVendido").value(0.01))
                .andExpect(jsonPath("$.pagina.items[2].valorVendido").value(0))
                .andExpect(jsonPath("$.faturamentoPeriodo").value(0.02));
        endpoint("categorias").andExpect(status().isOk()).andExpect(jsonPath("$.items[0].valorVendido").value(0.01))
                .andExpect(jsonPath("$.items[1].nome").value("Sem categoria"))
                .andExpect(jsonPath("$.items[1].valorVendido").value(0.01))
                .andExpect(jsonPath("$.faturamentoPeriodo").value(0.02));
        // Repetir a leitura não muda o desempate nem cria movimentos.
        endpoint("produtos").andExpect(jsonPath("$.pagina.items[0].produtoId").value(a.getId()));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM movimentacoes_financeiras", Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT sum(estoque_atual) FROM produtos WHERE empresa_id=?", BigDecimal.class, empresa.getId())).isEqualByComparingTo("0");
    }

    @Test void pagamentosMistosNaoMultiplicamValoresEOutroTenantNaoVaza() throws Exception {
        var a = produto("UN histórico", "UN", null); var b = produto("KG histórico", "KG", null);
        var v = venda(admin, "2026-10-22T12:00:00", "100", "10", StatusVenda.FATURADA);
        item(v, a, "2", "60", 1); item(v, b, "0.5", "50", 2);
        v.registrarFaturamento(UUID.randomUUID(), "synthetic", FormaPagamento.DINHEIRO, new BigDecimal("100"), BigDecimal.ZERO, BigDecimal.ZERO);
        vendas.saveAndFlush(v);
        var dinheiro = formas.saveAndFlush(new FormaPagamentoEntity("Dinheiro sintético", TipoFormaPagamento.DINHEIRO, true));
        var pix = formas.saveAndFlush(new FormaPagamentoEntity("PIX sintético", TipoFormaPagamento.PIX, true));
        pagamentos.saveAndFlush(new PagamentoEntity(v, admin, dinheiro, null, 1, new BigDecimal("30"), new BigDecimal("50")));
        pagamentos.saveAndFlush(new PagamentoEntity(v, admin, pix, null, 2, new BigDecimal("70"), null));
        var externo = produto("Não deve aparecer", "UN", null); externo.setEmpresa(outra); produtos.saveAndFlush(externo);
        var u = usuario(outra, "11144477735", PerfilUsuario.ADMIN);
        var outraVenda = venda(u, "2026-10-22T12:00:00", "900", "0", StatusVenda.FATURADA);
        item(outraVenda, externo, "9", "900", 1);
        consulta("2026-10-22", "2026-10-22").andExpect(jsonPath("$.atual.faturamento").value(100))
                .andExpect(jsonPath("$.atual.quantidadeVendas").value(1));
        endpoint("produtos").andExpect(status().isOk()).andExpect(jsonPath("$.pagina.totalItems").value(2))
                .andExpect(jsonPath("$.pagina.items[0].valorVendido").value(54.55))
                .andExpect(jsonPath("$.pagina.items[1].valorVendido").value(45.45));
        mvc.perform(pedido("produtos").param("empresaId", outra.getId().toString())).andExpect(jsonPath("$.faturamentoPeriodo").value(100));
        mvc.perform(get("/vendas/analise/resumo").header("Authorization", "Bearer " + jwt.gerarToken(u))
                .param("dataInicial", "2026-10-22").param("dataFinal", "2026-10-22"))
                .andExpect(jsonPath("$.atual.faturamento").value(900));
        mvc.perform(pedido("produtos").param("ordem", "quantidade")).andExpect(status().isBadRequest());
        mvc.perform(pedido("produtos").param("ordem", "quantidade").param("unidade", "KG"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.pagina.totalItems").value(1))
                .andExpect(jsonPath("$.pagina.items[0].quantidade").value(0.5))
                .andExpect(jsonPath("$.pagina.items[0].participacao").value(45.45));
        assertThat(pagamentos.count()).isEqualTo(2);
    }

    @Test void paginacaoEExportacaoCompletaProtegemFormulasSemUsarPaginaParcial() throws Exception {
        var v = venda(admin, "2026-10-22T10:00:00", "12", "2", StatusVenda.FATURADA);
        String[] nomes = {"=SUM(A1)", "+formula", "-formula", "@formula", "\t=oculta", "Texto; com \"aspas\"", "Último produto"};
        for (int i = 0; i < nomes.length; i++) item(v, produto(nomes[i], "UN", null), "1", "2", i);
        endpoint("produtos").andExpect(jsonPath("$.pagina.items.length()").value(5))
                .andExpect(jsonPath("$.pagina.totalItems").value(7)).andExpect(jsonPath("$.pagina.totalPages").value(2));
        mvc.perform(pedido("produtos").param("page", "1")).andExpect(jsonPath("$.pagina.items.length()").value(2));
        var resposta = mvc.perform(pedido("exportar").param("secao", "produtos")).andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/csv")).andReturn().getResponse();
        String csv = new String(resposta.getContentAsByteArray(), java.nio.charset.StandardCharsets.UTF_8);
        assertThat(csv).startsWith("\uFEFF").contains("\"'=SUM(A1)\"", "\"'+formula\"", "\"'-formula\"", "\"'@formula\"", "\"'\t=oculta\"", "Texto; com \"\"aspas\"\"", "Último produto");
        assertThat(csv.lines().count()).isEqualTo(8);
        var produtoFormula = produtos.findAll().stream().filter(p -> "Último produto".equals(p.getNome())).findFirst().orElseThrow();
        jdbc.update("UPDATE itens_venda SET nome_produto=? WHERE produto_id=?", "\u00A0＝unicode", produtoFormula.getId());
        var unicode = mvc.perform(pedido("exportar").param("secao", "produtos")).andExpect(status().isOk()).andReturn().getResponse();
        assertThat(new String(unicode.getContentAsByteArray(), java.nio.charset.StandardCharsets.UTF_8)).contains("'\u00A0＝unicode");
        for (String secao : new String[]{"resumo", "evolucao", "categorias"})
            mvc.perform(pedido("exportar").param("secao", secao)).andExpect(status().isOk());
        mvc.perform(pedido("produtos").param("ordem", "invalida")).andExpect(status().isBadRequest());
        mvc.perform(pedido("produtos").param("page", "-1")).andExpect(status().isBadRequest());
        mvc.perform(pedido("produtos").param("size", "1000")).andExpect(status().isBadRequest());
    }

    @Test void agregadosVaziosEAutorizacaoAplicamSeATodasAsRotas() throws Exception {
        endpoint("produtos").andExpect(status().isOk()).andExpect(jsonPath("$.pagina.totalItems").value(0));
        endpoint("categorias").andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
        admin.setPerfil(PerfilUsuario.OPERADOR); usuarios.saveAndFlush(admin); token = "Bearer " + jwt.gerarToken(admin);
        for (String endpoint : new String[]{"resumo", "produtos", "categorias", "exportar"})
            mvc.perform(pedido(endpoint).param("secao", "produtos")).andExpect(status().isForbidden());
    }

    @Test void historicoSemItensNaoGeraRankingInventado() throws Exception {
        venda(admin, "2026-10-22T10:00:00", "10", "0", StatusVenda.FATURADA);
        endpoint("produtos").andExpect(status().isConflict());
        endpoint("categorias").andExpect(status().isConflict());
    }

    @Test void faturamentoEfetivoPreservaCriacaoRetryCancelamentoEFiltroDaConsulta() throws Exception {
        prepararSessao();
        var p = produto("Produto vendido", "UN", null); p.setControlaEstoque(false); produtos.saveAndFlush(p);
        instante("2026-10-21T23:59:59");
        long id = criarAbertaComItem(p, "2");
        var chave = UUID.randomUUID();
        instante("2026-10-22T00:00:00");
        faturarDinheiro(id, "20", chave).andExpect(status().isOk());
        em.flush(); em.clear();
        var faturada = vendas.findById(id).orElseThrow();
        assertThat(faturada.getDataHora()).isEqualTo(LocalDateTime.parse("2026-10-21T23:59:59"));
        assertThat(faturada.getDataFaturamento()).isEqualTo(LocalDateTime.parse("2026-10-22T00:00:00"));
        consulta("2026-10-21", "2026-10-21").andExpect(jsonPath("$.atual.faturamento").value(0));
        consulta("2026-10-22", "2026-10-22").andExpect(jsonPath("$.atual.faturamento").value(20));
        instante("2026-10-22T14:03:00");
        faturarDinheiro(id, "20", chave).andExpect(status().isOk()); em.flush(); em.clear();
        assertThat(vendas.findById(id).orElseThrow().getDataFaturamento()).isEqualTo(faturada.getDataFaturamento());
        assertThat(pagamentos.count()).isEqualTo(1);
        mvc.perform(get("/vendas").header("Authorization", token).param("status", "FATURADA")
                .param("referenciaData", "FATURAMENTO").param("dataInicial", "2026-10-22").param("dataFinal", "2026-10-22"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1));
        mvc.perform(get("/vendas").header("Authorization", token).param("dataInicial", "2026-10-22").param("dataFinal", "2026-10-22"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(0));
        mvc.perform(post("/vendas/" + id + "/cancelar").header("Authorization", token)).andExpect(status().isOk());
        em.flush(); em.clear();
        assertThat(vendas.findById(id).orElseThrow().getDataFaturamento()).isEqualTo(faturada.getDataFaturamento());
        consulta("2026-10-22", "2026-10-22").andExpect(jsonPath("$.atual.faturamento").value(0));
    }

    @Test void vendaMesmoDiaEUnidadesHistoricasNaoSeMisturamAposEditarProduto() throws Exception {
        prepararSessao();
        var p = produto("Produto UN", "UN", null); p.setControlaEstoque(false); produtos.saveAndFlush(p);
        long primeira = criarAbertaComItem(p, "2"); faturarDinheiro(primeira, "20", UUID.randomUUID()).andExpect(status().isOk());
        em.flush(); em.clear();
        p = produtos.findById(p.getId()).orElseThrow(); p.setUnidadeMedida("KG"); produtos.saveAndFlush(p);
        long segunda = criarAbertaComItem(p, "0.5"); faturarDinheiro(segunda, "5", UUID.randomUUID()).andExpect(status().isOk());
        endpoint("produtos").andExpect(status().isOk()).andExpect(jsonPath("$.pagina.totalItems").value(2))
                .andExpect(jsonPath("$.pagina.items[0].unidade").value("UN"))
                .andExpect(jsonPath("$.pagina.items[0].quantidade").value(2))
                .andExpect(jsonPath("$.pagina.items[1].unidade").value("KG"))
                .andExpect(jsonPath("$.pagina.items[1].quantidade").value(0.5));
        mvc.perform(pedido("produtos").param("ordem", "quantidade").param("unidade", "KG"))
                .andExpect(jsonPath("$.pagina.totalItems").value(1)).andExpect(jsonPath("$.pagina.items[0].quantidade").value(0.5));
        var csv = mvc.perform(pedido("exportar").param("secao", "produtos")).andReturn().getResponse();
        assertThat(new String(csv.getContentAsByteArray(), java.nio.charset.StandardCharsets.UTF_8)).contains("Unidade histórica", "\"UN\";\"2,000\"", "\"KG\";\"0,500\"");
        em.flush(); em.clear(); var venda = vendas.findById(segunda).orElseThrow();
        assertThat(venda.getDataFaturamento()).isEqualTo(venda.getDataHora());
    }

    @Test void prazoSemPagamentoImediatoTambemRegistraFaturamento() throws Exception {
        prepararSessao();
        var c = new ClienteEntity(); c.setEmpresa(empresa); c.setNome("Cliente sintético"); c.setTipoPessoa(TipoPessoa.FISICA); clientes.saveAndFlush(c);
        var p = produto("Prazo", "UN", null); p.setControlaEstoque(false); produtos.saveAndFlush(p);
        instante("2026-10-20T10:00:00"); long id = criarAbertaComItem(p, "1");
        mvc.perform(put("/vendas/" + id + "/cliente").header("Authorization", token).contentType("application/json")
                .content("{\"clienteId\":" + c.getId() + "}")).andExpect(status().isOk());
        instante("2026-10-22T14:03:00");
        mvc.perform(post("/vendas/" + id + "/faturar").header("Authorization", token).contentType("application/json")
                .content(json.writeValueAsString(java.util.Map.of("chaveRequisicao", UUID.randomUUID(), "totalEsperado", 10,
                        "parcelasPrazo", java.util.List.of(java.util.Map.of("valor", 10, "vencimento", "2026-11-22"))))))
                .andExpect(status().isOk());
        em.flush(); em.clear();
        assertThat(vendas.findById(id).orElseThrow().getDataFaturamento()).isEqualTo(LocalDateTime.parse("2026-10-22T14:03:00"));
        assertThat(pagamentos.count()).isZero();
        consulta("2026-10-22", "2026-10-22").andExpect(jsonPath("$.atual.faturamento").value(10));
    }

    @Test void legadoSemDataNaoRecebeDataFicticiaEUnidadeDesconhecidaNaoViraQuantidade() throws Exception {
        var p = produto("Legado", "KG", null);
        var semData = venda(admin, "2026-10-22T10:00:00", "90", "0", StatusVenda.FATURADA); item(semData, p, "9", "90", 0);
        jdbc.update("UPDATE vendas SET data_faturamento=NULL WHERE id=?", semData.getId());
        var datavel = venda(admin, "2026-10-22T12:00:00", "20", "0", StatusVenda.FATURADA); item(datavel, p, "2", "20", 0);
        jdbc.update("UPDATE itens_venda SET unidade_medida_venda=NULL WHERE venda_id=?", datavel.getId());
        var outro = venda(usuario(outra, "11144477735", PerfilUsuario.ADMIN), "2026-10-22T12:00:00", "800", "0", StatusVenda.FATURADA);
        jdbc.update("UPDATE vendas SET data_faturamento=NULL WHERE id=?", outro.getId());
        consulta("2026-10-22", "2026-10-22").andExpect(jsonPath("$.atual.faturamento").value(20))
                .andExpect(jsonPath("$.vendasSemDataFaturamento").value(1));
        endpoint("produtos").andExpect(status().isOk()).andExpect(jsonPath("$.itensSemUnidade").value(1))
                .andExpect(jsonPath("$.unidades").isEmpty()).andExpect(jsonPath("$.pagina.items[0].quantidade").isEmpty())
                .andExpect(jsonPath("$.pagina.items[0].unidade").isEmpty()).andExpect(jsonPath("$.pagina.items[0].valorVendido").value(20));
        var csv = mvc.perform(pedido("exportar").param("secao", "produtos")).andReturn().getResponse();
        assertThat(new String(csv.getContentAsByteArray(), java.nio.charset.StandardCharsets.UTF_8)).contains("\"Não registrada\";\"\";\"20,00\"");
        mvc.perform(pedido("produtos").param("ordem", "quantidade").param("unidade", "KG")).andExpect(status().isBadRequest());
    }

    @Test void unidadeAlteradaDuranteVendaAbertaExigeRevisaoSemFaturarParcialmente() throws Exception {
        prepararSessao(); var p = produto("Revisar unidade", "UN", null); p.setControlaEstoque(false); produtos.saveAndFlush(p);
        long id = criarAbertaComItem(p, "2"); p.setUnidadeMedida("KG"); produtos.saveAndFlush(p);
        faturarDinheiro(id, "20", UUID.randomUUID()).andExpect(status().isConflict());
        em.flush(); em.clear();
        assertThat(vendas.findById(id).orElseThrow().getDataFaturamento()).isNull();
        assertThat(vendas.findById(id).orElseThrow().getStatus()).isEqualTo(StatusVenda.ABERTA);
        assertThat(pagamentos.count()).isZero();
    }

    @Test void migrationAditivaPreservaLegadoSemInventarSnapshots() {
        String schema = "upgrade_" + UUID.randomUUID().toString().replace("-", "");
        var antiga = Flyway.configure().dataSource(System.getProperty("novexa.test.analise.jdbc-url"), "novexa_analise_test", "")
                .schemas(schema).defaultSchema(schema).target("53").load();
        antiga.migrate();
        var banco = new JdbcTemplate(new org.springframework.jdbc.datasource.DriverManagerDataSource(
                System.getProperty("novexa.test.analise.jdbc-url") + "?currentSchema=" + schema, "novexa_analise_test", ""));
        banco.update("INSERT INTO empresas(id,razao_social,ativo) VALUES(1,'Legado sintético',true)");
        banco.update("INSERT INTO usuario(id,empresa_id,nome_usuario,perfil,ativo) VALUES(1,1,'Gestor','ADMIN',true)");
        banco.update("INSERT INTO produtos(id,empresa_id,nome,unidade_medida,preco_venda,data_cadastro) VALUES(1,1,'Legado','KG',10,'2026-10-01 12:00:00')");
        banco.update("INSERT INTO vendas(id,empresa_id,usuario_id,data_hora,status,subtotal,desconto,total) VALUES(1,1,1,'2026-10-01 12:00:00','FATURADA',10,0,10)");
        banco.update("INSERT INTO itens_venda(venda_id,produto_id,nome_produto,quantidade,preco_unitario,subtotal,ordem) VALUES(1,1,'Legado',1,10,10,0)");
        var atual = Flyway.configure().dataSource(System.getProperty("novexa.test.analise.jdbc-url"), "novexa_analise_test", "")
                .schemas(schema).defaultSchema(schema).load();
        atual.migrate(); atual.validate();
        assertThat(banco.queryForObject("SELECT data_hora FROM vendas WHERE id=1", Timestamp.class)).isEqualTo(Timestamp.valueOf("2026-10-01 12:00:00"));
        assertThat(banco.queryForObject("SELECT data_faturamento FROM vendas WHERE id=1", Timestamp.class)).isNull();
        assertThat(banco.queryForObject("SELECT unidade_medida_venda FROM itens_venda", String.class)).isNull();
        assertThat(banco.queryForObject("SELECT total FROM vendas WHERE id=1", BigDecimal.class)).isEqualByComparingTo("10");
    }

    @Test void ultimoMicrossegundoDeBrasiliaNaoArredondaParaODiaSeguinte() throws Exception {
        prepararSessao(); var p = produto("Meia-noite", "UN", null); p.setControlaEstoque(false); produtos.saveAndFlush(p);
        long id = criarAbertaComItem(p, "1");
        instante("2026-10-21T23:59:59.999999999");
        faturarDinheiro(id, "10", UUID.randomUUID()).andExpect(status().isOk()); em.flush(); em.clear();
        assertThat(vendas.findById(id).orElseThrow().getDataFaturamento())
                .isEqualTo(LocalDateTime.parse("2026-10-21T23:59:59.999999"));
        consulta("2026-10-21", "2026-10-21").andExpect(jsonPath("$.atual.faturamento").value(10));
        consulta("2026-10-22", "2026-10-22").andExpect(jsonPath("$.atual.faturamento").value(0));
    }

    void prepararSessao() {
        var c = new CaixaEntity(); c.setEmpresa(empresa); c.setDescricao("Caixa sintético");
        sessoes.saveAndFlush(new SessaoCaixaEntity(caixas.saveAndFlush(c), admin, BigDecimal.ZERO));
    }
    void instante(String data) { tempo.when(TempoNovexa::agora).thenReturn(LocalDateTime.parse(data)); }
    long criarAbertaComItem(ProdutoEntity p, String quantidade) throws Exception {
        var resposta = mvc.perform(post("/vendas/abertas").header("Authorization", token)).andExpect(status().isCreated()).andReturn().getResponse();
        long id = json.readTree(resposta.getContentAsString()).get("id").asLong();
        mvc.perform(post("/vendas/" + id + "/itens").header("Authorization", token).contentType("application/json")
                .content(json.writeValueAsString(java.util.Map.of("produtoId", p.getId(), "quantidade", new BigDecimal(quantidade)))))
                .andExpect(status().isOk()); return id;
    }
    org.springframework.test.web.servlet.ResultActions faturarDinheiro(long id, String total, UUID chave) throws Exception {
        return mvc.perform(post("/vendas/" + id + "/faturar").header("Authorization", token).contentType("application/json")
                .content(json.writeValueAsString(java.util.Map.of("chaveRequisicao", chave, "totalEsperado", new BigDecimal(total),
                        "formaPagamento", "DINHEIRO", "valorRecebido", new BigDecimal(total)))));
    }

    MockHttpServletRequestBuilder pedido(String endpoint) {
        return get("/vendas/analise/" + endpoint).header("Authorization", token)
                .param("dataInicial", "2026-10-22").param("dataFinal", "2026-10-22");
    }
    org.springframework.test.web.servlet.ResultActions endpoint(String endpoint) throws Exception { return mvc.perform(pedido(endpoint)); }
    ProdutoEntity produto(String nome, String unidade, CategoriaProdutoEntity categoria) {
        var p = new ProdutoEntity(); p.setEmpresa(empresa); p.setNome(nome); p.setUnidadeMedida(unidade); p.setCategoria(categoria);
        p.setPrecoVenda(BigDecimal.TEN); p.setPrecoCusto(BigDecimal.ZERO); p.setAtivo(true); p.setControlaEstoque(true);
        p.setEstoqueAtual(BigDecimal.ZERO); p.setEstoqueMinimo(BigDecimal.ZERO);
        return produtos.saveAndFlush(p);
    }
    void item(VendaEntity v, ProdutoEntity p, String quantidade, String subtotal, int ordem) {
        itens.saveAndFlush(new ItemVendaEntity(v, p, new BigDecimal(quantidade), new BigDecimal(subtotal), new BigDecimal(subtotal), null, ordem));
    }

    org.springframework.test.web.servlet.ResultActions consulta(String inicio, String fim) throws Exception {
        return mvc.perform(get("/vendas/analise/resumo").header("Authorization", token)
                .param("dataInicial", inicio).param("dataFinal", fim));
    }
    EmpresaEntity empresa(String nome, String cnpj) {
        var e = new EmpresaEntity(); e.setRazaoSocial(nome); e.setCnpj(cnpj); e.setAtivo(true);
        return empresas.saveAndFlush(e);
    }
    UsuarioEntity usuario(EmpresaEntity e, String cpf, PerfilUsuario perfil) {
        var u = new UsuarioEntity(); u.setEmpresa(e); u.setCpf(cpf); u.setNomeUsuario("Gestor sintético");
        u.setSenha("synthetic-hash-not-a-credential"); u.setAtivo(true); u.setPerfil(perfil);
        return usuarios.saveAndFlush(u);
    }
    VendaEntity venda(UsuarioEntity u, String data, String total, String desconto, StatusVenda status) {
        var v = new VendaEntity(u, null); v.setTotal(new BigDecimal(total)); v.setDesconto(new BigDecimal(desconto));
        v.setSubtotal(v.getTotal().add(v.getDesconto())); v.setStatus(status); v = vendas.saveAndFlush(v);
        jdbc.update("UPDATE vendas SET data_hora=?, data_faturamento=? WHERE id=?",
                Timestamp.valueOf(LocalDateTime.parse(data)), status == StatusVenda.FATURADA ? Timestamp.valueOf(LocalDateTime.parse(data)) : null, v.getId());
        return v;
    }
}
