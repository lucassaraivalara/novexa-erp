package br.com.novexa.erp.controller;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.sql.DriverManager;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties = {
        "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=60000",
        "supabase.url=http://127.0.0.1:9", "supabase.secret-key=local-test",
        "supabase.bucket=local", "spring.jpa.hibernate.ddl-auto=validate",
        "spring.jpa.show-sql=false", "spring.flyway.enabled=true",
        "spring.flyway.baseline-on-migrate=false"
})
@EnabledIfSystemProperty(named = "novexa.test.taxa.jdbc-url", matches = "jdbc:postgresql:.*")
class TaxaEntregaMigrationPostgresTest {
    private static final String URL = System.getProperty("novexa.test.taxa.jdbc-url");
    private static final String USER = System.getProperty("novexa.test.taxa.jdbc-user");
    private static final String PASSWORD = System.getenv("PGPASSWORD");
    private static final String LOCATION = "filesystem:" + System.getProperty("novexa.test.taxa.migrations");
    private static final String SCHEMA = "taxa_app_" + UUID.randomUUID().toString().replace("-", "");
    private static final String UPGRADE = "taxa_upgrade_" + UUID.randomUUID().toString().replace("-", "");

    @Autowired JdbcTemplate jdbc;

    @DynamicPropertySource static void postgres(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", () -> URL + "?currentSchema=" + SCHEMA);
        p.add("spring.datasource.username", () -> USER);
        p.add("spring.datasource.password", () -> PASSWORD);
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.flyway.locations", () -> LOCATION);
        p.add("spring.flyway.schemas", () -> SCHEMA);
        p.add("spring.flyway.default-schema", () -> SCHEMA);
    }

    @Test void upgradePreservaVendaHistoricaEValidaSchemaIntegrado() throws Exception {
        assertThat(jdbc.queryForObject("select max(version::integer) from flyway_schema_history where success", Integer.class))
                .isEqualTo(71);
        Flyway.configure().dataSource(URL, USER, PASSWORD).schemas(UPGRADE).defaultSchema(UPGRADE)
                .locations(LOCATION).target("70").load().migrate();
        try (var c = DriverManager.getConnection(URL, USER, PASSWORD); var s = c.createStatement()) {
            s.execute("SET search_path TO " + UPGRADE);
            s.execute("insert into empresas(id,razao_social,ativo) values (991,'Historico',true)");
            s.execute("insert into usuario(id,empresa_id,nome_usuario,cpf,senha,ativo,perfil) values (991,991,'Usuario','02360684663','hash',true,'ADMIN')");
            s.execute("""
                    insert into vendas(empresa_id,usuario_id,chave_requisicao,resumo_requisicao,data_hora,status,
                        subtotal,desconto,total,forma_pagamento,valor_recebido,troco)
                    values (991,991,'11111111-1111-1111-1111-111111111111','historico',CURRENT_TIMESTAMP,
                        'FATURADA',100,5,95,'DINHEIRO',100,5)
                    """);
        }
        var flyway = Flyway.configure().dataSource(URL, USER, PASSWORD).schemas(UPGRADE).defaultSchema(UPGRADE)
                .locations(LOCATION).load();
        assertThat(flyway.migrate().migrationsExecuted).isEqualTo(1);
        flyway.validate();
        try (var c = DriverManager.getConnection(URL, USER, PASSWORD); var s = c.createStatement()) {
            s.execute("SET search_path TO " + UPGRADE);
            try (var r = s.executeQuery("select subtotal,desconto,total,valor_recebido,troco,taxa_entrega from vendas")) {
                assertThat(r.next()).isTrue();
                assertThat(r.getBigDecimal(1)).isEqualByComparingTo("100");
                assertThat(r.getBigDecimal(2)).isEqualByComparingTo("5");
                assertThat(r.getBigDecimal(3)).isEqualByComparingTo("95");
                assertThat(r.getBigDecimal(4)).isEqualByComparingTo("100");
                assertThat(r.getBigDecimal(5)).isEqualByComparingTo("5");
                assertThat(r.getBigDecimal(6)).isZero();
            }
            assertThatThrownBy(() -> s.execute("update vendas set taxa_entrega=-1"))
                    .hasMessageContaining("ck_vendas_taxa_entrega_nao_negativa");
            s.execute("update vendas set taxa_entrega=2.50,total=97.50,troco=2.50");
            try (var r = s.executeQuery("select taxa_entrega,total from vendas")) {
                assertThat(r.next()).isTrue();
                assertThat(r.getBigDecimal(1)).isEqualByComparingTo("2.50");
                assertThat(r.getBigDecimal(2)).isEqualByComparingTo("97.50");
            }
            assertThatThrownBy(() -> s.execute("update vendas set total=96.00,troco=4.00"))
                    .hasMessageContaining("ck_vendas_total_com_taxa_entrega");
        }
        assertThat(flyway.migrate().migrationsExecuted).isZero();
    }

    @AfterAll static void limparSchemasDeTeste() throws Exception {
        try (var c = DriverManager.getConnection(URL, USER, PASSWORD); var s = c.createStatement()) {
            s.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
            s.execute("DROP SCHEMA IF EXISTS " + UPGRADE + " CASCADE");
        }
    }
}
