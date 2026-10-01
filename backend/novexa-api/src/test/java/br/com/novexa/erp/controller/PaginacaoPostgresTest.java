package br.com.novexa.erp.controller;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.sql.DriverManager;
import java.util.UUID;

@EnabledIfSystemProperty(named = "novexa.test.paginacao.jdbc-url", matches = "jdbc:postgresql:.*")
class PaginacaoPostgresTest extends PaginacaoHttpTest {
    private static final String SCHEMA = "teste_paginacao_" + UUID.randomUUID().toString().replace("-", "");
    private static final String URL = System.getProperty("novexa.test.paginacao.jdbc-url");
    private static final String USER = System.getProperty("novexa.test.paginacao.jdbc-user", "postgres");
    private static final String PASSWORD = System.getProperty("novexa.test.paginacao.jdbc-password", "");

    @DynamicPropertySource static void postgres(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", () -> URL + (URL.contains("?") ? "&" : "?") + "currentSchema=" + SCHEMA);
        properties.add("spring.datasource.username", () -> USER);
        properties.add("spring.datasource.password", () -> PASSWORD);
        properties.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        properties.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        properties.add("spring.flyway.enabled", () -> "true");
        properties.add("spring.flyway.default-schema", () -> SCHEMA);
        properties.add("spring.flyway.schemas", () -> SCHEMA);
        properties.add("spring.flyway.target", () -> "28");
    }

    @AfterAll static void removerSchemaDescartavel() throws Exception {
        try (var connection = DriverManager.getConnection(URL, USER, PASSWORD); var statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
        }
    }
}
