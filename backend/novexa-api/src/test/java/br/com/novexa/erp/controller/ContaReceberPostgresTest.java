package br.com.novexa.erp.controller;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.sql.DriverManager;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

@EnabledIfSystemProperty(named = "novexa.test.contas-receber.jdbc-url", matches = "jdbc:postgresql:.*")
class ContaReceberPostgresTest extends ContaReceberHttpTest {
    private static final String SCHEMA = "teste_contas_receber_" + UUID.randomUUID().toString().replace("-", "");
    private static final String URL = System.getProperty("novexa.test.contas-receber.jdbc-url");
    private static final String USER = System.getProperty("novexa.test.contas-receber.jdbc-user", "postgres");
    private static final String PASSWORD = System.getenv("PGPASSWORD");
    @Autowired PlatformTransactionManager transactionManager;

    @DynamicPropertySource static void postgres(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", () -> URL + (URL.contains("?") ? "&" : "?") + "currentSchema=" + SCHEMA);
        p.add("spring.datasource.username", () -> USER); p.add("spring.datasource.password", () -> PASSWORD);
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.jpa.hibernate.ddl-auto", () -> "validate"); p.add("spring.flyway.enabled", () -> "true");
        p.add("spring.flyway.default-schema", () -> SCHEMA); p.add("spring.flyway.schemas", () -> SCHEMA);
    }
    @Test void postgres18FlywayAtualEHibernateValidate() {
        assertThat(jdbc.queryForObject("show server_version", String.class)).startsWith("18.");
        assertThat(jdbc.queryForObject("select count(*) from flyway_schema_history where success and version is not null", Integer.class)).isEqualTo(36);
    }
    @RepeatedTest(3) void duasBaixasConcorrentesNaoUltrapassamSaldo() throws Exception {
        long id = criar().get("id").asLong();
        var resultados = concorrentes(id, null, () -> statusReceber(id, "70", UUID.randomUUID()), () -> statusReceber(id, "70", UUID.randomUUID()));
        assertThat(resultados).containsExactlyInAnyOrder(200, 409);
        saldo(bancoA, "70"); assertThat(contas.findById(id).orElseThrow().getValorRecebido()).isEqualByComparingTo("70"); assertThat(movimentos.count()).isEqualTo(1);
    }
    @RepeatedTest(3) void retryConcorrenteMesmaChaveNaoDuplica() throws Exception {
        long id = criar().get("id").asLong(); UUID chave = UUID.randomUUID();
        assertThat(concorrentes(id, null, () -> statusReceber(id, "100", chave), () -> statusReceber(id, "100", chave))).containsOnly(200);
        saldo(bancoA, "100"); assertThat(movimentos.count()).isEqualTo(1);
    }
    @RepeatedTest(3) void duasContasNoMesmoDestinoPreservamSaldo() throws Exception {
        long a = criar().get("id").asLong(), b = criar().get("id").asLong();
        assertThat(concorrentes(null, bancoA.getId(), () -> statusReceber(a, "40", UUID.randomUUID()), () -> statusReceber(b, "60", UUID.randomUUID()))).containsOnly(200);
        saldo(bancoA, "100"); assertThat(movimentos.count()).isEqualTo(2);
    }
    @RepeatedTest(3) void baixaEEstornoConcorrentesPreservamAcumulado() throws Exception {
        long id = criar().get("id").asLong(), m = receber(id, "40").get("recebimentos").get(0).get("id").asLong();
        assertThat(concorrentes(id, null, () -> statusReceber(id, "60", UUID.randomUUID()),
                () -> mvc.perform(post(BASE + "/" + id + "/recebimentos/" + m + "/estornar").header("Authorization", tokenA)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"motivoEstorno\":\"Correcao\"}")).andReturn().getResponse().getStatus())).containsOnly(200);
        saldo(bancoA, "60"); assertThat(contas.findById(id).orElseThrow().getValorRecebido()).isEqualByComparingTo("60");
        assertThat(contas.findById(id).orElseThrow().getStatus().name()).isEqualTo("PARCIAL"); assertThat(movimentos.count()).isEqualTo(2);
    }
    @Test void colisaoDeChaveEntreContasFazRollbackCompleto() throws Exception {
        long a = criar().get("id").asLong(), b = criar().get("id").asLong(); UUID chave = UUID.randomUUID();
        assertThat(concorrentes(null, bancoA.getId(), () -> statusReceber(a, "40", chave), () -> statusReceber(b, "40", chave))).containsExactlyInAnyOrder(200, 409);
        saldo(bancoA, "40"); assertThat(movimentos.count()).isEqualTo(1);
        assertThat(contas.findById(a).orElseThrow().getValorRecebido().add(contas.findById(b).orElseThrow().getValorRecebido())).isEqualByComparingTo("40");
    }
    @Test void constraintsMonetariasParcelasETenantNoBanco() throws Exception {
        long id = criar().get("id").asLong();
        for (String alteracao : List.of("valor_original = 0", "valor_recebido = -1", "valor_recebido = 101", "numero_parcela = 0", "numero_parcela = 2"))
            assertThatThrownBy(() -> jdbc.update("update contas_receber set " + alteracao + " where id = ?", id)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("update contas_receber set cliente_id = ? where id = ?", clienteB.getId(), id)).hasMessageContaining("fk_conta_receber_cliente_empresa");
        long m = receber(id, "40").get("recebimentos").get(0).get("id").asLong();
        assertThatThrownBy(() -> jdbc.update("update movimentacoes_financeiras set conta_financeira_id = ? where id = ?", bancoB.getId(), m)).hasMessageContaining("fk_mov_fin_conta_empresa");
        assertThatThrownBy(() -> jdbc.update("update movimentacoes_financeiras set empresa_id = ? where id = ?", empresaB.getId(), m)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("update movimentacoes_financeiras set tipo = 'SAIDA' where id = ?", m)).hasMessageContaining("chk_mov_fin_conta_receber");
        assertThatThrownBy(() -> jdbc.update("update movimentacoes_financeiras set chave_requisicao = null where id = ?", m)).hasMessageContaining("chk_mov_fin_conta_receber");
    }
    @Test void unicidadeChavePorTenantEVinculoNaoUnico() throws Exception {
        long id = criar().get("id").asLong(); UUID chave = UUID.randomUUID(); receber(id, baixa(bancoA.getId(), "40", chave), tokenA, 200);
        receber(id, "60"); assertThat(movimentos.count()).isEqualTo(2);
        assertThatThrownBy(() -> jdbc.update("""
            insert into movimentacoes_financeiras(empresa_id,conta_financeira_id,tipo,origem,descricao,valor,data_movimento,
                usuario_id,data_criacao,estornada,conta_receber_id,chave_requisicao)
            select empresa_id,conta_financeira_id,tipo,origem,descricao,valor,data_movimento,usuario_id,data_criacao,estornada,
                conta_receber_id,chave_requisicao from movimentacoes_financeiras where chave_requisicao = ?
            """, chave)).hasMessageContaining("uk_mov_fin_receber_chave");
        var p = pedido(); p.put("clienteId", clienteB.getId());
        long outra = resposta(mvc.perform(post(BASE).header("Authorization", tokenB).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(p)))).get("id").asLong();
        receber(outra, baixa(bancoB.getId(), "40", chave), tokenB, 200); saldo(bancoB, "40");
        long mb = jdbc.queryForObject("select id from movimentacoes_financeiras where empresa_id = ?", Long.class, empresaB.getId());
        assertThatThrownBy(() -> jdbc.update("update movimentacoes_financeiras set conta_receber_id = ? where id = ?", id, mb)).hasMessageContaining("fk_mov_fin_conta_receber_empresa");
    }
    @Test void upgradeV34ParaV35PreservaMovimentoHistorico() throws Exception {
        String upgrade = "teste_cr_upgrade_" + UUID.randomUUID().toString().replace("-", "");
        var antes = Flyway.configure().dataSource(URL, USER, PASSWORD).schemas(upgrade).defaultSchema(upgrade).target("34").load();
        try {
            antes.migrate();
            try (var c = DriverManager.getConnection(URL, USER, PASSWORD); var s = c.createStatement()) {
                s.execute("SET search_path TO " + upgrade);
                s.execute("insert into empresas(id,razao_social,ativo) values (991,'Historico',true)");
                s.execute("insert into usuario(id,empresa_id,nome_usuario,cpf,senha,ativo,perfil) values (991,991,'Usuario','02360684663','hash',true,'ADMIN')");
                s.execute("insert into contas_financeiras(id,empresa_id,nome,tipo,saldo_inicial,saldo_atual,ativo,data_criacao,data_atualizacao) values (991,991,'Saldo','OUTROS',0,10,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
                s.execute("insert into movimentacoes_financeiras(empresa_id,conta_financeira_id,tipo,origem,descricao,valor,data_movimento,usuario_id,data_criacao) values (991,991,'ENTRADA','MANUAL','Historico',10,CURRENT_DATE,991,CURRENT_TIMESTAMP)");
            }
            var depois = Flyway.configure().dataSource(URL, USER, PASSWORD).schemas(upgrade).defaultSchema(upgrade).load();
            assertThat(depois.migrate().migrationsExecuted).isEqualTo(2); depois.validate();
            try (var c = DriverManager.getConnection(URL, USER, PASSWORD); var s = c.createStatement()) {
                s.execute("SET search_path TO " + upgrade);
                try (var r = s.executeQuery("select valor,origem,conta_receber_id,chave_requisicao from movimentacoes_financeiras")) {
                    assertThat(r.next()).isTrue(); assertThat(r.getBigDecimal(1)).isEqualByComparingTo("10");
                    assertThat(r.getString(2)).isEqualTo("MANUAL"); assertThat(r.getObject(3)).isNull(); assertThat(r.getObject(4)).isNull(); assertThat(r.next()).isFalse();
                }
            }
        } finally { try (var c = DriverManager.getConnection(URL, USER, PASSWORD); var s = c.createStatement()) { s.execute("DROP SCHEMA IF EXISTS " + upgrade + " CASCADE"); } }
    }
    private int statusReceber(long id, String valor, UUID chave) throws Exception {
        return mvc.perform(post(BASE + "/" + id + "/receber").header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(baixa(bancoA.getId(), valor, chave)))).andReturn().getResponse().getStatus();
    }
    private List<Integer> concorrentes(Long contaId, Long destinoId, Callable<Integer> a, Callable<Integer> b) throws Exception {
        var executor = Executors.newFixedThreadPool(2);
        var iniciadas = new CountDownLatch(2);
        try {
            var futures = new ArrayList<Future<Integer>>();
            new TransactionTemplate(transactionManager).executeWithoutResult(t -> {
                if (contaId != null) contas.buscarParaAlterar(contaId, empresaA.getId()).orElseThrow();
                else financeiras.buscarParaAlterar(destinoId, empresaA.getId()).orElseThrow();
                futures.add(executor.submit(() -> { iniciadas.countDown(); return a.call(); }));
                futures.add(executor.submit(() -> { iniciadas.countDown(); return b.call(); }));
                try {
                    assertThat(iniciadas.await(5, TimeUnit.SECONDS)).isTrue();
                    long limite = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
                    int bloqueadas;
                    do {
                        jdbc.execute("select pg_stat_clear_snapshot()");
                        bloqueadas = jdbc.queryForObject("select count(*) from pg_stat_activity where wait_event_type = 'Lock' and query like '%for%update%'", Integer.class);
                        if (bloqueadas < 2) Thread.sleep(25);
                    } while (bloqueadas < 2 && System.nanoTime() < limite);
                    assertThat(bloqueadas).isGreaterThanOrEqualTo(2);
                    assertThat(futures).allMatch(f -> !f.isDone());
                } catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); }
            });
            return List.of(futures.get(0).get(20, TimeUnit.SECONDS), futures.get(1).get(20, TimeUnit.SECONDS));
        } finally { executor.shutdownNow(); assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue(); }
    }
    @AfterAll static void limparSchema() throws Exception {
        try (var c = DriverManager.getConnection(URL, USER, PASSWORD); var s = c.createStatement()) { s.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE"); }
    }
}
