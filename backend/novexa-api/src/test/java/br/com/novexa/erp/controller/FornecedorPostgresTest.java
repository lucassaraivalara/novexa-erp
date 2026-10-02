package br.com.novexa.erp.controller;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.sql.DriverManager;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@EnabledIfSystemProperty(named = "novexa.test.fornecedor.jdbc-url", matches = "jdbc:postgresql:.*")
class FornecedorPostgresTest extends FornecedorHttpTest {
    private static final String SCHEMA = "teste_fornecedor_" + UUID.randomUUID().toString().replace("-", "");
    private static final String URL = System.getProperty("novexa.test.fornecedor.jdbc-url");
    private static final String USER = System.getProperty("novexa.test.fornecedor.jdbc-user", "postgres");
    private static final String PASSWORD = System.getProperty("novexa.test.fornecedor.jdbc-password", "");
    @Autowired JdbcTemplate jdbc;
    @Autowired Environment environment;

    @DynamicPropertySource static void postgres(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", () -> URL + (URL.contains("?") ? "&" : "?") + "currentSchema=" + SCHEMA);
        p.add("spring.datasource.username", () -> USER);
        p.add("spring.datasource.password", () -> PASSWORD);
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        p.add("spring.flyway.enabled", () -> "true");
        p.add("spring.flyway.baseline-on-migrate", () -> "false");
        p.add("spring.flyway.default-schema", () -> SCHEMA);
        p.add("spring.flyway.schemas", () -> SCHEMA);
    }

    @Test void flywayDoZeroEHibernateValidate() {
        assertThat(jdbc.queryForObject("SELECT count(*) FROM flyway_schema_history WHERE version='33' AND success", Integer.class)).isEqualTo(1);
        assertThat(environment.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
        assertThat(jdbc.queryForObject("SELECT version()", String.class)).contains("PostgreSQL 18");
    }

    @AfterAll static void limparSchema() throws Exception {
        try (var c = DriverManager.getConnection(URL, USER, PASSWORD); var s = c.createStatement()) {
            s.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
        }
    }
}
