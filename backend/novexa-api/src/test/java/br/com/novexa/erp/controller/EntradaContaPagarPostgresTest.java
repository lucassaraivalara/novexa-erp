package br.com.novexa.erp.controller;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.sql.DriverManager;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@EnabledIfSystemProperty(named = "novexa.test.entrada.jdbc-url", matches = "jdbc:postgresql:.*")
class EntradaContaPagarPostgresTest extends EntradaMercadoriaHttpTest {
    static final String URL = System.getProperty("novexa.test.entrada.jdbc-url");
    static final String USER = System.getProperty("novexa.test.entrada.jdbc-user", "postgres");
    static final String PASSWORD = System.getenv().getOrDefault("NOVEXA_ENTRADA_TEST_DB_PASSWORD", "");
    static final String SCHEMA = "teste_entrada_pagar_" + UUID.randomUUID().toString().replace("-", "");

    @DynamicPropertySource static void postgres(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", () -> URL + (URL.contains("?") ? "&" : "?") + "currentSchema=" + SCHEMA);
        p.add("spring.datasource.username", () -> USER); p.add("spring.datasource.password", () -> PASSWORD);
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.jpa.hibernate.ddl-auto", () -> "validate"); p.add("spring.flyway.enabled", () -> "true");
        p.add("spring.flyway.baseline-on-migrate", () -> "false");
        p.add("spring.flyway.default-schema", () -> SCHEMA); p.add("spring.flyway.schemas", () -> SCHEMA);
    }

    @AfterAll static void limparSchema() throws Exception {
        try (var c = DriverManager.getConnection(URL, USER, PASSWORD); var s = c.createStatement()) {
            s.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
        }
    }

    @Test void flywayV37EConstraintsDeEmpresaEUnicidade() throws Exception {
        assertThat(jdbc.queryForObject("select count(*) from flyway_schema_history where version='37' and success", Integer.class)).isEqualTo(1);
        long entrada = confirmarNovaEntrada(), conta = contaPreexistente();
        obrigacao(entrada, "vincular", Map.of("contaPagarId", conta)).andExpect(status().isOk());
        long outraEntrada = confirmarNovaEntrada();
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> jdbc.update("""
                update entradas_mercadoria set conta_pagar_id=?, origem_conta_pagar='PREEXISTENTE',
                usuario_vinculo_conta_id=(select usuario_vinculo_conta_id from entradas_mercadoria where id=?),
                data_vinculo_conta=current_timestamp where id=?
                """, conta, entrada, outraEntrada)).hasMessageContaining("uk_entrada_conta_pagar");
        long contaOutroTenant = jdbc.queryForObject("insert into contas_pagar(empresa_id,descricao,data_vencimento,valor,status) values(?,'Outro tenant',current_date,10,'ABERTA') returning id", Long.class, outra.getId());
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> jdbc.update("update entradas_mercadoria set conta_pagar_id=? where id=?", contaOutroTenant, entrada))
                .hasMessageContaining("fk_entrada_conta_pagar_empresa");
    }

    @Test void geracaoConcorrenteERepeticaoCriamUmaUnicaObrigacao() throws Exception {
        long entrada = confirmarNovaEntrada(); var pedido = geracao();
        var resultados = disputar(() -> obrigacao(entrada, "gerar", pedido).andReturn().getResponse().getStatus(),
                () -> obrigacao(entrada, "gerar", pedido).andReturn().getResponse().getStatus());
        assertThat(resultados).allMatch(s -> s == 200 || s == 409).contains(200);
        obrigacao(entrada, "gerar", pedido).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("select count(*) from contas_pagar", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from movimentacoes_financeiras", Integer.class)).isZero();
    }

    @Test void duasEntradasDisputamAContaSemDuplicarVinculo() throws Exception {
        long a = confirmarNovaEntrada(), b = confirmarNovaEntrada(), conta = contaPreexistente();
        assertThat(disputar(() -> obrigacao(a, "vincular", Map.of("contaPagarId", conta)).andReturn().getResponse().getStatus(),
                () -> obrigacao(b, "vincular", Map.of("contaPagarId", conta)).andReturn().getResponse().getStatus()))
                .containsExactlyInAnyOrder(200, 409);
        assertThat(jdbc.queryForObject("select count(*) from entradas_mercadoria where conta_pagar_id=?", Integer.class, conta)).isEqualTo(1);
    }

    @Test void gerarContraCancelarNuncaDeixaObrigacaoAbertaDeEntradaCancelada() throws Exception {
        long entrada = confirmarNovaEntrada();
        var resultados = disputar(() -> obrigacao(entrada, "gerar", geracao()).andReturn().getResponse().getStatus(),
                () -> operacao(entrada, "cancelar").andReturn().getResponse().getStatus());
        assertThat(resultados).allMatch(s -> s == 200 || s == 409).contains(200);
        operacao(entrada, "cancelar").andExpect(status().isOk());
        assertThat(jdbc.queryForObject("select count(*) from contas_pagar where status='ABERTA'", Integer.class)).isZero();
        assertThat(saldo(produto)).isEqualByComparingTo("10");
    }

    @Test void pagamentoConcorrenteComCancelamentoPreservaFinanceiroEEstoque() throws Exception {
        long entrada = confirmarNovaEntrada();
        long conta = json.readTree(obrigacao(entrada, "gerar", geracao()).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).path("conta").path("id").asLong();
        var financeira = contasFinanceirasTeste.saveAndFlush(new br.com.novexa.erp.entity.ContaFinanceiraEntity(empresa,
                "Cofre teste", br.com.novexa.erp.entity.TipoContaFinanceira.COFRE, new java.math.BigDecimal("200")));
        var resultados = disputar(() -> mvc.perform(post("/financeiro/contas-pagar/" + conta + "/pagar")
                .header("Authorization", authorization).contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(Map.of("contaFinanceiraId", financeira.getId(), "valorPago", "65.25", "dataPagamento", "2026-10-15"))))
                .andReturn().getResponse().getStatus(), () -> operacao(entrada, "cancelar").andReturn().getResponse().getStatus());
        assertThat(resultados).containsExactlyInAnyOrder(200, 409);
        if (resultados.getFirst() == 200) {
            mvc.perform(get("/estoque/entradas/" + entrada + "/conta-pagar").header("Authorization", authorization))
                    .andExpect(jsonPath("$.conta.status").value("PAGA")).andExpect(jsonPath("$.podeCancelarEntrada").value(false));
            assertThat(saldo(produto)).isEqualByComparingTo("15");
            mvc.perform(post("/financeiro/contas-pagar/" + conta + "/estornar").header("Authorization", authorization)).andExpect(status().isOk());
            operacao(entrada, "cancelar").andExpect(status().isOk());
        }
        assertThat(saldo(produto)).isEqualByComparingTo("10");
        assertThat(contasFinanceirasTeste.findById(financeira.getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo("200");
        assertThat(jdbc.queryForObject("select count(*) from movimentacoes_financeiras where not estornada and origem='CONTAS_A_PAGAR'", Integer.class)).isZero();
    }

    private List<Integer> disputar(Callable<Integer> a, Callable<Integer> b) throws Exception {
        var pool = Executors.newFixedThreadPool(2); var inicio = new CountDownLatch(1);
        try {
            var x = pool.submit(() -> { inicio.await(); return a.call(); });
            var y = pool.submit(() -> { inicio.await(); return b.call(); });
            inicio.countDown(); return List.of(x.get(25, TimeUnit.SECONDS), y.get(25, TimeUnit.SECONDS));
        } finally { pool.shutdownNow(); assertThat(pool.awaitTermination(10, TimeUnit.SECONDS)).isTrue(); }
    }
}
