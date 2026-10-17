package br.com.novexa.erp.controller;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Map;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "novexa.test.marcas.jdbc-url", matches = "jdbc:postgresql:.*")
class MarcaPostgresTest extends MarcaHttpTest {
    @Autowired JdbcTemplate jdbc;
    private static final String SCHEMA = "teste_marcas_" + UUID.randomUUID().toString().replace("-", "");
    private static final String URL = System.getProperty("novexa.test.marcas.jdbc-url");
    private static final String USER = System.getProperty("novexa.test.marcas.jdbc-user", "novexa_test");

    @DynamicPropertySource static void postgres(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", () -> URL + "?currentSchema=" + SCHEMA);
        p.add("spring.datasource.username", () -> USER);
        p.add("spring.datasource.password", () -> "");
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        p.add("spring.flyway.enabled", () -> "true");
        p.add("spring.flyway.default-schema", () -> SCHEMA);
        p.add("spring.flyway.schemas", () -> SCHEMA);
    }

    @Test void migrationProtegeDuplicidadeTenantEExclusaoMesmoForaDoService() throws Exception {
        assertThat(jdbc.queryForObject("select count(*) from flyway_schema_history where version='39' and success", Integer.class)).isEqualTo(1);
        long marca = criar(tokenA, Map.of("nome", "Acme"));
        sqlRejeitado("23505", "insert into marcas(empresa_id,nome,ativo) values (?, 'acme', true)", empresaA.getId());
        var p = produto(empresaB, null, true);
        sqlRejeitado("23503", "update produtos set marca_id=? where id=?", marca, p.getId());
        var vinculado = produto(empresaA, marcas.findById(marca).orElseThrow(), false);
        sqlRejeitado("23503", "delete from marcas where id=?", marca);
        assertThat(jdbc.queryForObject("select marca_id from produtos where id=?", Long.class, vinculado.getId())).isEqualTo(marca);
    }

    private void sqlRejeitado(String estado, String sql, Object... parametros) throws Exception {
        var c = DataSourceUtils.getConnection(jdbc.getDataSource());
        var savepoint = c.setSavepoint();
        try (var ps = c.prepareStatement(sql)) {
            for (int i = 0; i < parametros.length; i++) ps.setObject(i + 1, parametros[i]);
            assertThatThrownBy(ps::executeUpdate).isInstanceOf(SQLException.class)
                .satisfies(e -> assertThat(((SQLException)e).getSQLState()).isEqualTo(estado));
        } finally { c.rollback(savepoint); c.releaseSavepoint(savepoint); }
    }

    @AfterAll static void removerSchemaDescartavel() throws Exception {
        try (var c = DriverManager.getConnection(URL, USER, ""); var s = c.createStatement()) {
            s.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
        }
    }
}
