package br.com.novexa.erp.repository;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import java.sql.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "novexa.test.conferencia.jdbc-url", matches = "jdbc:postgresql:.*")
class ConferenciaFechamentoCaixaMigrationTest {
    @Test void preservaLegadoProtegeTenantUnicidadeEValidaHibernate() throws Exception {
        String url = System.getProperty("novexa.test.conferencia.jdbc-url");
        String user = System.getProperty("novexa.test.conferencia.jdbc-user", "postgres");
        String schema = "conferencia_" + UUID.randomUUID().toString().replace("-", "");
        var anterior = Flyway.configure().dataSource(url, user, "").schemas(schema).defaultSchema(schema)
                .locations("classpath:db/migration").target("15").load();
        anterior.migrate();
        try (var c = DriverManager.getConnection(url, user, "")) {
            c.setSchema(schema);
            sql(c, "INSERT INTO empresas(id,razao_social,ativo) VALUES(1,'A',true),(2,'B',true)");
            sql(c, "INSERT INTO usuario(id,empresa_id,nome_usuario,ativo) VALUES(1,1,'A',true),(2,2,'B',true)");
            sql(c, "INSERT INTO caixas(id,empresa_id,descricao) VALUES(1,1,'A'),(2,2,'B')");
            sql(c, """
                    INSERT INTO sessoes_caixa(id,empresa_id,caixa_id,usuario_abertura_id,usuario_fechamento_id,
                        saldo_inicial,saldo_final,data_abertura,data_fechamento,status)
                    VALUES(1,1,1,1,1,100,90,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'FECHADO')
                    """);
            var atual = Flyway.configure().dataSource(url, user, "").schemas(schema).defaultSchema(schema)
                    .locations("classpath:db/migration").load();
            assertThat(atual.migrate().migrationsExecuted).isEqualTo(1);
            atual.validate();
            assertThat(atual.migrate().migrationsExecuted).isZero();
            try (var s = c.createStatement(); var r = s.executeQuery("SELECT modalidade_conferencia,saldo_final,observacao_fechamento FROM sessoes_caixa WHERE id=1")) {
                assertThat(r.next()).isTrue();
                assertThat(r.getString(1)).isEqualTo("LEGADA");
                assertThat(r.getBigDecimal(2)).isEqualByComparingTo("90");
                assertThat(r.getString(3)).isNull();
            }
            assertThat(numero(c, "SELECT count(*) FROM conferencias_fechamento_caixa")).isZero();
            sql(c, "UPDATE sessoes_caixa SET modalidade_conferencia='POR_FORMA' WHERE id=1");
            String dinheiro = """
                    INSERT INTO conferencias_fechamento_caixa(empresa_id,sessao_id,escopo,forma_pagamento_id,
                        descricao_snapshot,tipo_snapshot,valor_esperado,valor_informado)
                    VALUES(1,1,'DINHEIRO_FISICO',NULL,'Dinheiro','DINHEIRO',100,90)
                    """;
            String pix = dinheiro.replace("'DINHEIRO_FISICO',NULL,'Dinheiro','DINHEIRO',100,90",
                    "'FORMA_PAGAMENTO',2,'PIX','PIX',10,10");
            sql(c, dinheiro);
            sql(c, pix);
            assertThatThrownBy(() -> sql(c, dinheiro)).isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> sql(c, pix)).isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> sql(c, pix.replace("VALUES(1,1,", "VALUES(2,1,")
                    .replace("'FORMA_PAGAMENTO',2", "'FORMA_PAGAMENTO',3")))
                    .isInstanceOfSatisfying(SQLException.class, e -> assertThat(e.getSQLState()).isEqualTo("23503"));
            assertThatThrownBy(() -> sql(c, pix.replace("'FORMA_PAGAMENTO',2", "'FORMA_PAGAMENTO',999"))).isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> sql(c, pix.replace("'FORMA_PAGAMENTO',2", "'FORMA_PAGAMENTO',NULL"))).isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> sql(c, dinheiro.replace("'DINHEIRO_FISICO',NULL", "'DINHEIRO_FISICO',1"))).isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> sql(c, pix.replace("'FORMA_PAGAMENTO',2,'PIX','PIX',10,10",
                    "'FORMA_PAGAMENTO',3,'Debito','DEBITO',10,-1"))).isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> sql(c, "UPDATE sessoes_caixa SET modalidade_conferencia='OUTRA' WHERE id=1")).isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> sql(c, "UPDATE sessoes_caixa SET observacao_fechamento=' ' WHERE id=1")).isInstanceOf(SQLException.class);
            assertThat(numero(c, "SELECT count(*) FROM conferencias_fechamento_caixa")).isEqualTo(2);
            var factory = new LocalContainerEntityManagerFactoryBean();
            factory.setDataSource(new DriverManagerDataSource(url, user, ""));
            factory.setPackagesToScan("br.com.novexa.erp.entity");
            factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
            factory.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto", "validate", "hibernate.default_schema", schema,
                    "hibernate.physical_naming_strategy", "org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy"));
            try { factory.afterPropertiesSet(); } finally { factory.destroy(); }
        } finally {
            try (var c = DriverManager.getConnection(url, user, "")) { sql(c, "DROP SCHEMA " + schema + " CASCADE"); }
        }
    }

    private static void sql(Connection c, String sql) throws SQLException {
        try (var s = c.createStatement()) { s.execute(sql); }
    }
    private static long numero(Connection c, String sql) throws SQLException {
        try (var s = c.createStatement(); var r = s.executeQuery(sql)) { r.next(); return r.getLong(1); }
    }
}
