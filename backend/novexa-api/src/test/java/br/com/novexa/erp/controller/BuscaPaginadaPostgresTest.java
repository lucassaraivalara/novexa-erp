package br.com.novexa.erp.controller;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.sql.DriverManager;
import java.util.UUID;

@EnabledIfSystemProperty(named = "novexa.test.busca-paginada.jdbc-url", matches = "jdbc:postgresql:.*")
class BuscaPaginadaPostgresTest extends BuscaPaginadaHttpTest {
    private static final String SCHEMA = "teste_busca_" + UUID.randomUUID().toString().replace("-", "");
    private static final String URL = System.getProperty("novexa.test.busca-paginada.jdbc-url");
    private static final String USER = System.getProperty("novexa.test.busca-paginada.jdbc-user", "novexa_test");
    @DynamicPropertySource static void postgres(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", () -> URL + "?currentSchema=" + SCHEMA);
        p.add("spring.datasource.username", () -> USER); p.add("spring.datasource.password", () -> "");
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.jpa.hibernate.ddl-auto", () -> "validate"); p.add("spring.flyway.enabled", () -> "true");
        p.add("spring.flyway.default-schema", () -> SCHEMA); p.add("spring.flyway.schemas", () -> SCHEMA);
    }
    @AfterAll static void removerSchemaDescartavel() throws Exception {
        try (var c = DriverManager.getConnection(URL, USER, ""); var s = c.createStatement()) {
            s.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
        }
    }
}
