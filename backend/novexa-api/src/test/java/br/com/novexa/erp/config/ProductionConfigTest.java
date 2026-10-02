package br.com.novexa.erp.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.*;

class ProductionConfigTest {
    private MockEnvironment valid() {
        return new MockEnvironment()
                .withProperty("spring.datasource.url", "jdbc:postgresql://db.test/novexa")
                .withProperty("spring.datasource.username", "novexa")
                .withProperty("spring.datasource.password", "password-not-to-log")
                .withProperty("novexa.jwt.secret", "01234567890123456789012345678901")
                .withProperty("supabase.url", "https://storage.test")
                .withProperty("supabase.secret-key", "storage-secret-not-to-log")
                .withProperty("supabase.bucket", "produtos")
                .withProperty("novexa.cors.allowed-origins", "https://app.test,https://admin.test")
                .withProperty("spring.jpa.hibernate.ddl-auto", "validate")
                .withProperty("spring.jpa.show-sql", "false")
                .withProperty("spring.flyway.enabled", "true")
                .withProperty("spring.flyway.baseline-on-migrate", "false")
                .withProperty("spring.flyway.clean-disabled", "true")
                .withProperty("spring.flyway.validate-on-migrate", "true");
    }

    @Test void aceitaConfiguracaoExplicita() {
        assertThatCode(() -> new ProductionConfig(valid()).validate()).doesNotThrowAnyException();
    }

    @Test void rejeitaOverrideInseguroAntesDeInicializarBeans() {
        try (var context = new org.springframework.context.annotation.AnnotationConfigApplicationContext()) {
            context.setEnvironment(valid().withProperty("spring.flyway.baseline-on-migrate", "true"));
            context.getEnvironment().setActiveProfiles("prod");
            context.register(ProductionConfig.class);
            context.registerBean("migration", Object.class, () -> {
                throw new AssertionError("Nao deveria inicializar antes da validacao");
            });
            assertThatThrownBy(context::refresh).isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("spring.flyway.baseline-on-migrate");
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"spring.datasource.url", "spring.datasource.username", "spring.datasource.password",
            "novexa.jwt.secret", "supabase.url", "supabase.secret-key", "supabase.bucket", "novexa.cors.allowed-origins"})
    void rejeitaValoresObrigatoriosVaziosSemExporSegredos(String key) {
        var env = valid().withProperty(key, "");
        assertThatThrownBy(() -> new ProductionConfig(env).validate())
                .isInstanceOf(IllegalStateException.class).hasMessageContaining(key)
                .hasMessageNotContaining("password-not-to-log").hasMessageNotContaining("storage-secret-not-to-log");
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "spring.datasource.url|jdbc:h2:mem:nao-producao", "novexa.jwt.secret|curto",
            "novexa.cors.allowed-origins|*", "novexa.cors.allowed-origins|http://localhost:5173",
            "novexa.cors.allowed-origins|https://app.test/caminho", "novexa.cors.allowed-origins|https://*.app.test",
            "novexa.cors.allowed-origins|https://app.test,", "novexa.cors.allowed-origins|https://login:segredo@app.test",
            "supabase.url|http://storage.test", "spring.jpa.hibernate.ddl-auto|update",
            "spring.jpa.show-sql|true", "spring.flyway.enabled|false", "spring.flyway.clean-disabled|false",
            "spring.flyway.baseline-on-migrate|true", "spring.flyway.validate-on-migrate|false"
    })
    void rejeitaConfiguracaoInsegura(String key, String value) {
        assertThatThrownBy(() -> new ProductionConfig(valid().withProperty(key, value)).validate())
                .isInstanceOf(IllegalStateException.class).hasMessageContaining(key).hasMessageNotContaining(value);
    }
}
