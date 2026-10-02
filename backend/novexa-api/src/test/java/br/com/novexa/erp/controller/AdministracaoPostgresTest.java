package br.com.novexa.erp.controller;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.sql.DriverManager;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "novexa.test.admin.jdbc-url", matches = "jdbc:postgresql:.*")
class AdministracaoPostgresTest extends UsuarioIsolamentoTest {
    private static final String SCHEMA = "teste_admin_" + UUID.randomUUID().toString().replace("-", "");
    private static final String URL = System.getProperty("novexa.test.admin.jdbc-url");
    private static final String USER = System.getProperty("novexa.test.admin.jdbc-user", "postgres");
    private static final String PASSWORD = System.getProperty("novexa.test.admin.jdbc-password", "");

    @DynamicPropertySource static void postgres(DynamicPropertyRegistry p) throws Exception {
        Flyway.configure().dataSource(URL, USER, PASSWORD).schemas(SCHEMA).defaultSchema(SCHEMA)
                .target("31").load().migrate();
        try (var c = DriverManager.getConnection(URL, USER, PASSWORD); var s = c.createStatement()) {
            s.execute("INSERT INTO " + SCHEMA + ".usuario(nome_usuario,cpf,senha,ativo,perfil) "
                    + "VALUES ('Historico','987.654.321-00','hash preservado',false,'USUARIO')");
        }
        p.add("spring.datasource.url", () -> URL + (URL.contains("?") ? "&" : "?") + "currentSchema=" + SCHEMA);
        p.add("spring.datasource.username", () -> USER);
        p.add("spring.datasource.password", () -> PASSWORD);
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        p.add("spring.flyway.enabled", () -> "true");
        p.add("spring.flyway.default-schema", () -> SCHEMA);
        p.add("spring.flyway.schemas", () -> SCHEMA);
    }

    @Test void upgradePreservaHistoricoEImpedeCpfDuplicadoMesmoComMascara() throws Exception {
        try (var c = DriverManager.getConnection(URL, USER, PASSWORD); var s = c.createStatement()) {
            try (var r = s.executeQuery("SELECT telefone,senha FROM " + SCHEMA + ".usuario WHERE nome_usuario='Historico'")) {
                assertThat(r.next()).isTrue();
                assertThat(r.getString(1)).isNull();
                assertThat(r.getString(2)).isEqualTo("hash preservado");
            }
            assertThatThrownBy(() -> s.execute("INSERT INTO " + SCHEMA + ".usuario(cpf) VALUES ('98765432100')"))
                    .hasMessageContaining("uk_usuario_cpf_normalizado");
            try (var r = s.executeQuery("SELECT max(version::int) FROM " + SCHEMA + ".flyway_schema_history WHERE success")) {
                assertThat(r.next()).isTrue();
                assertThat(r.getInt(1)).isEqualTo(32);
            }
        }
    }

    @AfterAll static void limparSchema() throws Exception {
        try (var c = DriverManager.getConnection(URL, USER, PASSWORD); var s = c.createStatement()) {
            s.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
        }
    }
}
