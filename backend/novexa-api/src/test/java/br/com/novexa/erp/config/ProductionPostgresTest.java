package br.com.novexa.erp.config;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.env.Environment;
import org.springframework.http.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.sql.DriverManager;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "novexa.jwt.secret=01234567890123456789012345678901",
        "supabase.url=https://storage.test", "supabase.secret-key=synthetic-production-test-key",
        "supabase.bucket=produtos", "novexa.cors.allowed-origins=https://app.test"
})
@ActiveProfiles("prod")
@EnabledIfSystemProperty(named = "novexa.test.production.jdbc-url", matches = "jdbc:postgresql:.*")
class ProductionPostgresTest {
    private static final String SCHEMA = "teste_producao_" + UUID.randomUUID().toString().replace("-", "");
    private static final String URL = System.getProperty("novexa.test.production.jdbc-url");
    private static final String USER = System.getProperty("novexa.test.production.jdbc-user", "postgres");
    private static final String PASSWORD = System.getProperty("novexa.test.production.jdbc-password", "synthetic-test-password");
    @Autowired TestRestTemplate http;
    @Autowired Environment environment;

    @DynamicPropertySource static void postgres(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", () -> URL + (URL.contains("?") ? "&" : "?") + "currentSchema=" + SCHEMA);
        p.add("spring.datasource.username", () -> USER);
        p.add("spring.datasource.password", () -> PASSWORD);
        p.add("spring.flyway.default-schema", () -> SCHEMA);
        p.add("spring.flyway.schemas", () -> SCHEMA);
    }

    @Test void probesPublicosSemDetalhesEOutrosActuatorsNaoExpostos() {
        for (String path : new String[]{"/actuator/health", "/actuator/health/liveness", "/actuator/health/readiness"}) {
            var r = http.getForEntity(path, Map.class);
            assertThat(r.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(r.getBody()).containsEntry("status", "UP").doesNotContainKeys("components", "details");
            assertThat(r.getBody().keySet()).allMatch(key -> key.equals("status") || key.equals("groups"));
            assertThat(r.getHeaders().getFirst("X-Request-ID")).isNotBlank();
        }
        for (String path : new String[]{"/actuator/env", "/actuator/configprops", "/actuator/loggers", "/actuator/metrics"})
            assertThat(http.getForEntity(path, String.class).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(environment.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
        assertThat(environment.getProperty("spring.flyway.enabled")).isEqualTo("true");
        assertThat(environment.getProperty("spring.flyway.baseline-on-migrate")).isEqualTo("false");
        assertThat(environment.getProperty("server.shutdown")).isEqualTo("graceful");
    }

    @Test void errosNaoExibemExcecaoOuStacktraceERecebemId() {
        var headers = new HttpHeaders(); headers.set("X-Request-ID", "producao-erro-123");
        headers.setContentType(MediaType.APPLICATION_JSON);
        var r = http.postForEntity("/auth/login", new HttpEntity<>("{", headers), String.class);
        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(r.getHeaders().getFirst("X-Request-ID")).isEqualTo("producao-erro-123");
        assertThat(r.getBody()).doesNotContain("Exception", "trace", "br.com.novexa", "postgres", "password", "synthetic");
    }

    @Test void corsExplicitoEHeadersProtegemApi() {
        var headers = new HttpHeaders(); headers.setOrigin("https://app.test");
        headers.setAccessControlRequestMethod(HttpMethod.POST);
        headers.setAccessControlRequestHeaders(java.util.List.of("Authorization", "Content-Type", "X-Request-ID"));
        var r = http.exchange("/auth/login", HttpMethod.OPTIONS, new HttpEntity<>(headers), String.class);
        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(r.getHeaders().getAccessControlAllowOrigin()).isEqualTo("https://app.test");
        headers.setOrigin("https://nao-permitido.test");
        assertThat(http.exchange("/auth/login", HttpMethod.OPTIONS, new HttpEntity<>(headers), String.class)
                .getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        var protectedResponse = http.getForEntity("/usuarios", String.class);
        assertThat(protectedResponse.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(protectedResponse.getHeaders().getFirst("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(protectedResponse.getHeaders().getFirst("X-Frame-Options")).isEqualTo("DENY");
        assertThat(protectedResponse.getHeaders().getFirst("Content-Security-Policy")).contains("default-src 'none'");
        assertThat(protectedResponse.getHeaders().getFirst("Referrer-Policy")).isEqualTo("no-referrer");
    }

    @AfterAll static void limparSchema() throws Exception {
        try (var c = DriverManager.getConnection(URL, USER, PASSWORD); var s = c.createStatement()) {
            s.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
        }
    }
}
