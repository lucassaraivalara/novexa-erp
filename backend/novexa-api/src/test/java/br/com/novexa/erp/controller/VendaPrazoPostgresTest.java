package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.StatusContaReceber;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.http.MediaType;
import org.springframework.test.context.*;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.support.TransactionTemplate;
import java.sql.DriverManager;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

@EnabledIfSystemProperty(named = "novexa.test.venda-prazo.jdbc-url", matches = "jdbc:postgresql:.*")
@Sql(statements = {"delete from formas_pagamento", """
    insert into formas_pagamento(id,descricao,tipo,ativo) values
        (1,'Dinheiro','DINHEIRO',true),(2,'PIX','PIX',true),
        (3,'Debito','DEBITO',true),(4,'Credito','CREDITO',true),
        (5,'Boleto','BOLETO',true),(6,'Transferencia','TRANSFERENCIA',true);
    """, "alter sequence formas_pagamento_id_seq restart with 7"})
class VendaPrazoPostgresTest extends VendaPrazoHttpTest {
    private static final String SCHEMA = "teste_venda_prazo_" + UUID.randomUUID().toString().replace("-", "");
    private static final String URL = System.getProperty("novexa.test.venda-prazo.jdbc-url");
    private static final String USER = System.getProperty("novexa.test.venda-prazo.jdbc-user", "postgres");
    private static final String PASSWORD = System.getenv("PGPASSWORD");

    @DynamicPropertySource static void postgres(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", () -> URL + (URL.contains("?") ? "&" : "?") + "currentSchema=" + SCHEMA);
        p.add("spring.datasource.username", () -> USER); p.add("spring.datasource.password", () -> PASSWORD);
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.jpa.hibernate.ddl-auto", () -> "validate"); p.add("spring.flyway.enabled", () -> "true");
        p.add("spring.flyway.default-schema", () -> SCHEMA); p.add("spring.flyway.schemas", () -> SCHEMA);
    }
    @Test void prazoPostgres18FlywayHibernateEConstraintParcela() throws Exception {
        assertThat(jdbc.queryForObject("show server_version", String.class)).startsWith("18.");
        assertThat(jdbc.queryForObject("select max(version::integer) from flyway_schema_history where success", Integer.class)).isEqualTo(36);
        var v = enviarPrazo(pedidoPrazo(""), 201);
        long conta = v.get("contasReceber").get(0).get("id").asLong();
        assertThatThrownBy(() -> jdbc.update("""
            insert into contas_receber(empresa_id,cliente_id,venda_id,descricao,valor_original,valor_recebido,
                data_vencimento,status,origem,numero_parcela,total_parcelas,data_criacao,data_atualizacao)
            select empresa_id,cliente_id,venda_id,descricao,valor_original,valor_recebido,
                data_vencimento,status,origem,numero_parcela,total_parcelas,data_criacao,data_atualizacao
            from contas_receber where id=?
            """, conta)).hasMessageContaining("uk_conta_receber_venda_parcela");
        assertThatThrownBy(() -> jdbc.update("update contas_receber set empresa_id=? where id=?", outra.getId(), conta))
                .hasMessageContaining("fk_conta_receber_cliente_empresa");
    }
    @RepeatedTest(3) void prazoRetryConcorrenteSerializaNoOperadorSemDuplicar() throws Exception {
        var p = pedidoPrazo("1,2,4");
        var resultados = concorrentes(() -> vendas.bloquearOperador(operador.getId(), empresa.getId()).orElseThrow(),
                () -> finalizarStatus(p), () -> finalizarStatus(p));
        assertThat(resultados).containsOnly(201);
        assertThat(vendas.count()).isEqualTo(1); assertThat(contasReceber.count()).isEqualTo(2);
        assertThat(pagamentos.count()).isEqualTo(3); assertThat(movimentos.count()).isEqualTo(1); assertThat(movimentosCaixa.count()).isEqualTo(1);
    }
    @RepeatedTest(3) void prazoDoisOperadoresFaturandoMesmaVendaNaoDuplicamParcelas() throws Exception {
        var p = pedidoPrazo("");
        long id = json.readTree(mvc.perform(post("/vendas/abertas").header("Authorization", authorization))
                .andReturn().getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(post("/vendas/" + id + "/itens").header("Authorization", authorization).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("produtoId", produto.getId(), "quantidade", 2))));
        mvc.perform(put("/vendas/" + id + "/cliente").header("Authorization", authorization).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("clienteId", p.get("clienteId")))));
        String outroToken = "Bearer " + jwt.gerarToken(segundo);
        var outraRequisicao = new HashMap<>(p); outraRequisicao.put("chaveRequisicao", UUID.randomUUID());
        Callable<Integer> primeiro = () -> faturarStatusPrazo(id, p, authorization);
        Callable<Integer> outro = () -> faturarStatusPrazo(id, outraRequisicao, outroToken);
        var resultados = concorrentes(() -> vendas.findByIdAndEmpresaIdWithLock(id, empresa.getId()).orElseThrow(), primeiro, outro);
        assertThat(resultados).containsExactlyInAnyOrder(200, 409);
        assertThat(contasReceber.count()).isEqualTo(2); assertThat(pagamentos.count()).isZero();
        assertThat(movimentos.count()).isEqualTo(1); assertThat(movimentosFinanceiros.count()).isZero();
    }
    private int faturarStatusPrazo(long id, Map<String, Object> p, String token) throws Exception {
        return mvc.perform(post("/vendas/" + id + "/faturar").header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(p))).andReturn().getResponse().getStatus();
    }
    @Test void prazoUpgradeV35ParaV36PreservaVendaHistorica() throws Exception {
        String schema = "teste_venda_upgrade_" + UUID.randomUUID().toString().replace("-", "");
        try {
            Flyway.configure().dataSource(URL, USER, PASSWORD).schemas(schema).defaultSchema(schema).target("35").load().migrate();
            try (var c = DriverManager.getConnection(URL, USER, PASSWORD); var s = c.createStatement()) {
                s.execute("SET search_path TO " + schema);
                s.execute("insert into empresas(id,razao_social,ativo) values (991,'Historico',true)");
                s.execute("insert into usuario(id,empresa_id,nome_usuario,cpf,senha,ativo,perfil) values (991,991,'Usuario','02360684663','hash',true,'ADMIN')");
                s.execute("""
                    insert into vendas(empresa_id,usuario_id,chave_requisicao,resumo_requisicao,data_hora,status,
                        subtotal,desconto,total,forma_pagamento,valor_recebido,troco)
                    values (991,991,'11111111-1111-1111-1111-111111111111','historico',CURRENT_TIMESTAMP,
                        'FATURADA',100,0,100,'DINHEIRO',110,10)
                    """);
            }
            var flyway = Flyway.configure().dataSource(URL, USER, PASSWORD).schemas(schema).defaultSchema(schema).load();
            assertThat(flyway.migrate().migrationsExecuted).isEqualTo(1); flyway.validate();
            try (var c = DriverManager.getConnection(URL, USER, PASSWORD); var s = c.createStatement()) {
                s.execute("SET search_path TO " + schema);
                try (var r = s.executeQuery("select total,valor_recebido,troco,valor_prazo from vendas")) {
                    assertThat(r.next()).isTrue(); assertThat(r.getBigDecimal(1)).isEqualByComparingTo("100");
                    assertThat(r.getBigDecimal(2)).isEqualByComparingTo("110"); assertThat(r.getBigDecimal(3)).isEqualByComparingTo("10");
                    assertThat(r.getBigDecimal(4)).isZero();
                }
                assertThatThrownBy(() -> s.execute("update vendas set valor_prazo=-1,troco=9")).hasMessageContaining("chk_venda_valor_prazo");
                assertThatThrownBy(() -> s.execute("update vendas set valor_recebido=0")).hasMessageContaining("chk_venda_");
                s.execute("update vendas set valor_prazo=100,valor_recebido=0,troco=0");
                assertThatThrownBy(() -> s.execute("update vendas set troco=1")).hasMessageContaining("chk_venda_troco_com_prazo");
            }
        } finally {
            try (var c = DriverManager.getConnection(URL, USER, PASSWORD); var s = c.createStatement()) {
                s.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
            }
        }
    }
    @RepeatedTest(3) void prazoBaixaVsCancelamentoNaoDeixaCreditoAtivo() throws Exception {
        var v = enviarPrazo(pedidoPrazo("1,4"), 201); long venda = v.get("id").asLong();
        long conta = v.get("contasReceber").get(0).get("id").asLong(), destino = contasFinanceiras.findAll().getFirst().getId();
        var resultados = concorrentes(() -> contasReceber.buscarParaAlterar(conta, empresa.getId()).orElseThrow(),
                () -> mvc.perform(post("/financeiro/contas-receber/" + conta + "/receber").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("contaFinanceiraId", destino,
                                "valor", 4, "dataRecebimento", java.time.LocalDate.now().toString(), "chaveRequisicao", UUID.randomUUID()))))
                        .andReturn().getResponse().getStatus(),
                () -> cancelarStatus(venda));
        assertThat(resultados.get(0)).isIn(200, 409); assertThat(resultados.get(1)).isEqualTo(200);
        assertThat(contasReceber.findAll()).allSatisfy(c -> { assertThat(c.getStatus()).isEqualTo(StatusContaReceber.CANCELADA); assertThat(c.getValorRecebido()).isZero(); });
        assertThat(contasFinanceiras.findById(destino).orElseThrow().getSaldoAtual()).isEqualByComparingTo("100");
        assertThat(movimentosFinanceiros.findAll()).allSatisfy(m -> assertThat(m.isEstornada()).isTrue());
    }
    @RepeatedTest(3) void prazoDuploCancelamentoNaoDuplicaEstorno() throws Exception {
        var v = enviarPrazo(pedidoPrazo("1,4"), 201); long venda = v.get("id").asLong();
        var banco = contasFinanceiras.findAll().getFirst(); receberPrazo(v.get("contasReceber").get(0).get("id").asLong(), banco.getId(), 4);
        assertThat(concorrentes(() -> vendas.bloquearOperador(operador.getId(), empresa.getId()).orElseThrow(),
                () -> cancelarStatus(venda), () -> cancelarStatus(venda))).containsOnly(200);
        assertThat(movimentosFinanceiros.count()).isEqualTo(1); assertThat(movimentosFinanceiros.findAll().getFirst().isEstornada()).isTrue();
        assertThat(contasFinanceiras.findById(banco.getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo("100");
        assertThat(movimentos.count()).isEqualTo(2);
    }
    private int finalizarStatus(Map<String, Object> p) throws Exception {
        return mvc.perform(post("/vendas").header("Authorization", authorization).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(p))).andReturn().getResponse().getStatus();
    }
    private int cancelarStatus(long id) throws Exception {
        return mvc.perform(post("/vendas/" + id + "/cancelar").header("Authorization", authorization)).andReturn().getResponse().getStatus();
    }
    private List<Integer> concorrentes(Runnable lock, Callable<Integer> a, Callable<Integer> b) throws Exception {
        var pool = Executors.newFixedThreadPool(2); var iniciadas = new CountDownLatch(2); var futures = new ArrayList<Future<Integer>>();
        try {
            new TransactionTemplate(transactions).executeWithoutResult(tx -> {
                lock.run();
                futures.add(pool.submit(() -> { iniciadas.countDown(); return a.call(); }));
                futures.add(pool.submit(() -> { iniciadas.countDown(); return b.call(); }));
                try {
                    assertThat(iniciadas.await(5, TimeUnit.SECONDS)).isTrue();
                    long limite = System.nanoTime() + TimeUnit.SECONDS.toNanos(10); int bloqueadas;
                    do {
                        jdbc.execute("select pg_stat_clear_snapshot()");
                        bloqueadas = jdbc.queryForObject("select count(*) from pg_stat_activity where wait_event_type='Lock' and query like '%for%update%'", Integer.class);
                        if (bloqueadas < 2) Thread.sleep(25);
                    } while (bloqueadas < 2 && System.nanoTime() < limite);
                    assertThat(bloqueadas).isGreaterThanOrEqualTo(2); assertThat(futures).allMatch(f -> !f.isDone());
                } catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); }
            });
            return List.of(futures.get(0).get(20, TimeUnit.SECONDS), futures.get(1).get(20, TimeUnit.SECONDS));
        } finally { pool.shutdownNow(); assertThat(pool.awaitTermination(10, TimeUnit.SECONDS)).isTrue(); }
    }
    @AfterAll static void limparSchemaPrazo() throws Exception {
        try (var c = DriverManager.getConnection(URL, USER, PASSWORD); var s = c.createStatement()) {
            s.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
        }
    }
}
