package br.com.novexa.erp.config;

import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;

import java.net.URI;
import java.nio.charset.StandardCharsets;

@Configuration
@Profile("prod")
public class ProductionConfig {
    private final Environment environment;

    public ProductionConfig(Environment environment) {
        this.environment = environment;
    }

    @Bean
    static BeanFactoryPostProcessor validateProductionEnvironment(Environment environment) {
        // Fail before datasource/Flyway initialization, including unsafe environment overrides.
        return factory -> new ProductionConfig(environment).validate();
    }

    void validate() {
        String url = required("spring.datasource.url");
        if (!url.startsWith("jdbc:postgresql:")) invalid("spring.datasource.url");
        required("spring.datasource.username");
        required("spring.datasource.password");
        if (required("novexa.jwt.secret").getBytes(StandardCharsets.UTF_8).length < 32) invalid("novexa.jwt.secret");
        required("supabase.secret-key");
        required("supabase.bucket");
        httpsOrigin(required("supabase.url"), "supabase.url");
        for (String origin : required("novexa.cors.allowed-origins").split(",", -1))
            httpsOrigin(origin.trim(), "novexa.cors.allowed-origins");
        expect("spring.jpa.hibernate.ddl-auto", "validate");
        expect("spring.jpa.show-sql", "false");
        expect("spring.flyway.enabled", "true");
        expect("spring.flyway.baseline-on-migrate", "false");
        expect("spring.flyway.clean-disabled", "true");
        expect("spring.flyway.validate-on-migrate", "true");
    }

    private String required(String key) {
        String value = environment.getProperty(key);
        if (value == null || value.isBlank() || value.contains("${")) invalid(key);
        return value;
    }

    private void expect(String key, String value) {
        if (!value.equals(required(key))) invalid(key);
    }

    private void httpsOrigin(String value, String key) {
        try {
            URI uri = URI.create(value);
            if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null
                    || uri.getRawQuery() != null || uri.getRawFragment() != null || !uri.getRawPath().isEmpty())
                invalid(key);
        } catch (IllegalArgumentException e) {
            invalid(key);
        }
    }

    private void invalid(String key) {
        // Report the property name, never its value or secret.
        throw new IllegalStateException("Configuracao de producao invalida: " + key);
    }
}
