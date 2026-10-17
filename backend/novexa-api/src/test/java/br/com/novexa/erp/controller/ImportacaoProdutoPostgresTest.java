package br.com.novexa.erp.controller;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.flywaydb.core.Flyway;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Map;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "novexa.test.importacao-produtos.jdbc-url", matches = "jdbc:postgresql:.*")
class ImportacaoProdutoPostgresTest extends ImportacaoProdutoHttpTest {
    @Autowired JdbcTemplate jdbc;
    private static final String SCHEMA = "teste_importacao_produtos_" + UUID.randomUUID().toString().replace("-", "");
    private static final String URL = System.getProperty("novexa.test.importacao-produtos.jdbc-url");
    private static final String USER = System.getProperty("novexa.test.importacao-produtos.jdbc-user", "novexa_test");

    @DynamicPropertySource static void postgres(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", () -> URL + "?currentSchema=" + SCHEMA);
        p.add("spring.datasource.username", () -> USER); p.add("spring.datasource.password", () -> "");
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.jpa.hibernate.ddl-auto", () -> "validate"); p.add("spring.flyway.enabled", () -> "true");
        p.add("spring.flyway.default-schema", () -> SCHEMA); p.add("spring.flyway.schemas", () -> SCHEMA);
    }

    @Test void migrationProtegeTenantEExclusaoFisicaSemCascade() throws Exception {
        assertThat(jdbc.queryForObject("select count(*) from flyway_schema_history where version='42' and success", Integer.class)).isEqualTo(1);
        long produtoId = criar(tokenA, Map.of("fornecedorId", fornecedorA, "ativo", false));
        sqlRejeitado("update produtos set fornecedor_principal_id=? where id=?", fornecedorB, produtoId);
        sqlRejeitado("delete from fornecedores where id=?", fornecedorA);
        assertThat(jdbc.queryForObject("select fornecedor_principal_id from produtos where id=?", Long.class, produtoId)).isEqualTo(fornecedorA);
    }

    @Test void upgradeDaV41PreservaProdutosPreExistentes() throws Exception {
        String schemaUpgrade = "teste_upgrade_importacao_" + UUID.randomUUID().toString().replace("-", "");
        try {
            Flyway.configure().dataSource(URL, USER, "").defaultSchema(schemaUpgrade).schemas(schemaUpgrade).target("41").load().migrate();
            try (var c = DriverManager.getConnection(URL + "?currentSchema=" + schemaUpgrade, USER, ""); var s = c.createStatement()) {
                s.executeUpdate("insert into empresas(id,razao_social,ativo) values (900001,'Legada',true)");
                s.executeUpdate("insert into produtos(id,empresa_id,nome,unidade_medida,preco_venda,preco_custo,estoque_atual,data_cadastro) values (900001,900001,'Produto legado','UN',10,3,5,current_timestamp)");
            }
            Flyway.configure().dataSource(URL, USER, "").defaultSchema(schemaUpgrade).schemas(schemaUpgrade).load().migrate();
            try (var c = DriverManager.getConnection(URL + "?currentSchema=" + schemaUpgrade, USER, ""); var s = c.createStatement(); var r = s.executeQuery("select nome,preco_venda,preco_custo,estoque_atual,fornecedor_principal_id,ncm,cest from produtos where id=900001")) {
                assertThat(r.next()).isTrue(); assertThat(r.getString("nome")).isEqualTo("Produto legado");
                assertThat(r.getBigDecimal("preco_venda")).isEqualByComparingTo("10");
                assertThat(r.getBigDecimal("preco_custo")).isEqualByComparingTo("3");
                assertThat(r.getBigDecimal("estoque_atual")).isEqualByComparingTo("5");
                assertThat(r.getObject("fornecedor_principal_id")).isNull(); assertThat(r.getObject("ncm")).isNull(); assertThat(r.getObject("cest")).isNull();
            }
        } finally {
            try (var c = DriverManager.getConnection(URL, USER, ""); var s = c.createStatement()) { s.execute("DROP SCHEMA IF EXISTS " + schemaUpgrade + " CASCADE"); }
        }
    }

    @Test void confirmacoesConcorrentesNaoDuplicamLote() throws Exception {
        String id=previa(CAB+linha("Concorrente","LOTE-CONCORRENTE","7890000000001","0"));
        org.springframework.test.context.transaction.TestTransaction.flagForCommit();
        org.springframework.test.context.transaction.TestTransaction.end();
        try(var executor=java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var inicio=new java.util.concurrent.CountDownLatch(1);
            var tarefas=new java.util.ArrayList<java.util.concurrent.Future<Integer>>();
            for(int n=0;n<2;n++) tarefas.add(executor.submit(()-> { inicio.await();
                return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/produtos/importacoes/"+id+"/confirmar")
                    .header("Authorization",tokenA)).andReturn().getResponse().getStatus(); }));
            inicio.countDown();
            for(var tarefa:tarefas) assertThat(tarefa.get(30,java.util.concurrent.TimeUnit.SECONDS)).isEqualTo(200);
        }
        assertThat(jdbc.queryForObject("select count(*) from produtos where empresa_id=? and codigo_interno='LOTE-CONCORRENTE'",Integer.class,empresaA.getId())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select importados from importacoes_produtos where id=?",Integer.class,java.util.UUID.fromString(id))).isEqualTo(1);
        for(String tabela:new String[]{"produtos","importacoes_produtos","subcategorias_produtos","categorias_produtos","marcas","fornecedores","usuario"})
            jdbc.update("delete from "+tabela+" where empresa_id in (?,?)",empresaA.getId(),empresaB.getId());
        jdbc.update("delete from empresas where id in (?,?)",empresaA.getId(),empresaB.getId());
        org.springframework.test.context.transaction.TestTransaction.start();
    }

    private void sqlRejeitado(String sql, Object... parametros) throws Exception {
        var c = DataSourceUtils.getConnection(jdbc.getDataSource()); var savepoint = c.setSavepoint();
        try (var ps = c.prepareStatement(sql)) {
            for (int i = 0; i < parametros.length; i++) ps.setObject(i + 1, parametros[i]);
            assertThatThrownBy(ps::executeUpdate).isInstanceOf(SQLException.class)
                .satisfies(e -> assertThat(((SQLException)e).getSQLState()).isEqualTo("23503"));
        } finally { c.rollback(savepoint); c.releaseSavepoint(savepoint); }
    }
    @AfterAll static void removerSchemaDescartavel() throws Exception {
        try (var c = DriverManager.getConnection(URL, USER, ""); var s = c.createStatement()) { s.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE"); }
    }
}
