package br.com.novexa.erp.controller;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Map;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "novexa.test.categorias.jdbc-url", matches = "jdbc:postgresql:.*")
class CategoriaProdutoPostgresTest extends CategoriaProdutoHttpTest {
    @org.springframework.beans.factory.annotation.Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    private static final String SCHEMA = "teste_categorias_" + UUID.randomUUID().toString().replace("-", "");
    private static final String URL = System.getProperty("novexa.test.categorias.jdbc-url");
    private static final String USER = System.getProperty("novexa.test.categorias.jdbc-user", "novexa_test");

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

    @Test void migrationProtegeDuplicidadeERelacaoTenantMesmoForaDoService() throws Exception {
        long cat = criar("categorias", tokenA, Map.of("nome", "Bebidas"));
        // A fixture está numa transação: usar a mesma conexão mantém seus registros visíveis.
        assertThat(jdbc.queryForObject("select count(*) from flyway_schema_history where version='38' and success", Integer.class)).isEqualTo(1);
        var connection = org.springframework.jdbc.datasource.DataSourceUtils.getConnection(jdbc.getDataSource());
        var savepoint = connection.setSavepoint();
        try (var ps = connection.prepareStatement("insert into categorias_produtos(empresa_id,nome,ativo) values (?, 'bebidas', true)")) {
            ps.setLong(1, empresaA.getId());
            assertThatThrownBy(ps::executeUpdate).isInstanceOf(SQLException.class).satisfies(e -> assertThat(((SQLException)e).getSQLState()).isEqualTo("23505"));
        } finally { connection.rollback(savepoint); }
        savepoint = connection.setSavepoint();
        try (var ps = connection.prepareStatement("insert into subcategorias_produtos(empresa_id,categoria_id,nome,ativo) values (?, ?, 'Inválida', true)")) {
            ps.setLong(1, empresaB.getId()); ps.setLong(2, cat);
            assertThatThrownBy(ps::executeUpdate).isInstanceOf(SQLException.class).satisfies(e -> assertThat(((SQLException)e).getSQLState()).isEqualTo("23503"));
        } finally { connection.rollback(savepoint); }
    }

    @AfterAll static void removerSchemaDescartavel() throws Exception {
        try (var c = DriverManager.getConnection(URL, USER, ""); var s = c.createStatement()) {
            s.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
        }
    }
}
