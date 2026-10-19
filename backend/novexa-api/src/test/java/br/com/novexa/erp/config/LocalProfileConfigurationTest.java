package br.com.novexa.erp.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

class LocalProfileConfigurationTest {
    private ApplicationContextRunner runner() {
        return new ApplicationContextRunner()
                .withInitializer(new ConfigDataApplicationContextInitializer())
                .withPropertyValues(
                        "DB_URL=jdbc:postgresql://remote.invalid:5432/not_local",
                        "SUPABASE_URL=https://remote.invalid",
                        "LOCAL_DB_PASSWORD=synthetic-local-password",
                        "LOCAL_JWT_SECRET=synthetic-local-key-at-least-32-bytes");
    }

    @Test void perfilLocalIgnoraDestinosRemotosGenericosSemDesligarValidacoes() {
        runner().withPropertyValues("spring.profiles.active=local").run(context -> {
            var env = context.getEnvironment();
            assertThat(env.getProperty("spring.datasource.url"))
                    .isEqualTo("jdbc:postgresql://localhost:5432/novexa_erp");
            assertThat(env.getProperty("supabase.url")).isEqualTo("http://127.0.0.1:9");
            assertThat(env.getProperty("novexa.geocoding.url")).isEmpty();
            assertThat(env.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
            assertThat(env.getProperty("spring.flyway.enabled")).isEqualTo("true");
            assertThat(env.getProperty("spring.flyway.baseline-on-migrate")).isEqualTo("false");
            assertThat(env.getProperty("spring.flyway.clean-disabled")).isEqualTo("true");
            assertThat(env.getProperty("novexa.cors.allowed-origins"))
                    .isEqualTo("http://localhost:5173,http://127.0.0.1:5173");
            assertThat(env.getProperty("management.endpoint.health.group.readiness.include"))
                    .contains("db");
        });
    }

    @Test void testesSemPerfilUsamH2SemImportarCredenciaisPrivadas() {
        runner().withPropertyValues("spring.profiles.active=").run(context -> {
            var env = context.getEnvironment();
            assertThat(env.getProperty("spring.datasource.url")).startsWith("jdbc:h2:mem:");
            assertThat(env.getProperty("spring.datasource.driver-class-name")).isEqualTo("org.h2.Driver");
            assertThat(env.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("create-drop");
            assertThat(env.getProperty("spring.flyway.enabled")).isEqualTo("false");
            assertThat(env.getProperty("spring.config.import")).isEmpty();
            assertThat(env.getProperty("supabase.url")).isEqualTo("http://127.0.0.1:9");
            assertThat(env.getProperty("novexa.jwt.secret")).startsWith("synthetic-test-only-");
        });
    }
}
