package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.EmpresaCadastroDados;
import br.com.novexa.erp.entity.RegimeTributario;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.jdbc.Sql;
import java.sql.DriverManager;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

@EnabledIfSystemProperty(named = "novexa.test.venda-estoque.jdbc-url", matches = "jdbc:postgresql:.*")
@Sql(statements = {"delete from formas_pagamento", """
    insert into formas_pagamento(id,descricao,tipo,ativo) values
        (1,'Dinheiro','DINHEIRO',true),(2,'PIX','PIX',true),
        (3,'Debito','DEBITO',true),(4,'Credito','CREDITO',true),
        (5,'Boleto','BOLETO',true),(6,'Transferencia','TRANSFERENCIA',true);
    """, "alter sequence formas_pagamento_id_seq restart with 7"})
class VendaEstoquePostgresTest extends VendaHttpTest {
    private static final String SCHEMA = "teste_estoque_" + UUID.randomUUID().toString().replace("-", "");
    private static final String URL = System.getProperty("novexa.test.venda-estoque.jdbc-url");
    @Autowired Flyway flyway;
    @DynamicPropertySource static void postgres(DynamicPropertyRegistry p) {
        if (!URL.matches("jdbc:postgresql://(127\\.0\\.0\\.1|localhost):[0-9]+/.*"))
            throw new IllegalStateException("Use somente PostgreSQL local descartável.");
        p.add("spring.datasource.url", () -> URL + "?currentSchema=" + SCHEMA);
        p.add("spring.datasource.username", () -> "postgres");
        p.add("spring.datasource.password", () -> "synthetic-test-password");
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.flyway.enabled", () -> "true");
        p.add("spring.flyway.schemas", () -> SCHEMA);
        p.add("spring.flyway.default-schema", () -> SCHEMA);
        p.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    }
    @Test void v44ValidaHistoricoHibernateMeiEPadraoSeguro() {
        flyway.validate();
        assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("44");
        assertThat(empresa.getPermitirVendaEstoqueNegativo()).isFalse();
        var cadastro = new EmpresaCadastroDados(); cadastro.setRegimeTributario(RegimeTributario.MEI);
        empresa.setCadastro(cadastro); empresas.saveAndFlush(empresa);
        assertThat(jdbc.queryForObject("select regime_tributario from empresas where id=?", String.class, empresa.getId())).isEqualTo("MEI");
        assertThat(jdbc.queryForObject("select permitir_venda_estoque_negativo from empresas where id=?", Boolean.class, empresa.getId())).isFalse();
    }
    @Test void upgradeV43Para44PreservaEmpresaComBloqueioPorPadrao() throws Exception {
        String schema = SCHEMA + "_upgrade";
        try {
            Flyway.configure().dataSource(URL, "postgres", "synthetic-test-password").schemas(schema).defaultSchema(schema)
                    .target("43").load().migrate();
            try (var c = DriverManager.getConnection(URL, "postgres", "synthetic-test-password"); var s = c.createStatement()) {
                s.execute("insert into " + schema + ".empresas(razao_social,cnpj,ativo) values ('Legado V43','11222333000181',true)");
            }
            var atual = Flyway.configure().dataSource(URL, "postgres", "synthetic-test-password").schemas(schema).defaultSchema(schema).load();
            assertThat(atual.migrate().migrationsExecuted).isEqualTo(1);
            atual.validate();
            try (var c = DriverManager.getConnection(URL, "postgres", "synthetic-test-password"); var s = c.createStatement();
                    var r = s.executeQuery("select permitir_venda_estoque_negativo,razao_social from " + schema + ".empresas")) {
                assertThat(r.next()).isTrue(); assertThat(r.getBoolean(1)).isFalse(); assertThat(r.getString(2)).isEqualTo("Legado V43");
            }
        } finally {
            try (var c = DriverManager.getConnection(URL, "postgres", "synthetic-test-password"); var s = c.createStatement()) {
                s.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
            }
        }
    }
    @AfterAll static void limparSchema() throws Exception {
        try (var c = DriverManager.getConnection(URL, "postgres", "synthetic-test-password"); var s = c.createStatement()) {
            s.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
        }
    }
}
