package br.com.novexa.erp.controller;

import br.com.novexa.erp.support.NfeXmlTeste;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.sql.DriverManager;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@EnabledIfSystemProperty(named = "novexa.test.entrada.jdbc-url", matches = "jdbc:postgresql:.*")
class EntradaXmlPostgresTest extends EntradaXmlHttpTest {
    private static final String URL = System.getProperty("novexa.test.entrada.jdbc-url");
    private static final String USER = System.getProperty("novexa.test.entrada.jdbc-user", "postgres");
    private static final String PASSWORD = System.getProperty("novexa.test.entrada.jdbc-password",
            System.getenv().getOrDefault("NOVEXA_XML_TEST_DB_PASSWORD", ""));
    private static final String SCHEMA = "teste_entrada_xml_" + UUID.randomUUID().toString().replace("-", "");
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
    @Test void pgXmlFlywayV34ValidateEUnicidadeEstrutural() throws Exception {
        assertThat(jdbc.queryForObject("select version()", String.class)).contains("PostgreSQL 18");
        assertThat(jdbc.queryForObject("select count(*) from flyway_schema_history where version='34' and success", Integer.class)).isEqualTo(1);
        fromXml(pedidoXml()).andExpect(status().isCreated());
        var outro = pedidoXml(); outro.put("chaveAcessoNfe", "2".repeat(44)); outro.put("numeroNota", "124");
        long id = id(fromXml(outro).andExpect(status().isCreated()));
        assertThatThrownBy(() -> jdbc.update("update entradas_mercadoria set chave_acesso_nfe=? where id=?", NfeXmlTeste.CHAVE, id))
                .hasMessageContaining("uk_entrada_chave_nfe");
        assertThat(movimentos.count()).isZero();
    }
}
