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

@EnabledIfSystemProperty(named = "novexa.test.caixa.jdbc-url", matches = "jdbc:postgresql:.*")
class CaixaOperacionalMigrationTest {
    @Test void migraHistoricoValidaHibernateConstraintsEIdempotencia() throws Exception {
        String url = System.getProperty("novexa.test.caixa.jdbc-url");
        String user = System.getProperty("novexa.test.caixa.jdbc-user", "postgres");
        String schema = "caixa_mvp_" + UUID.randomUUID().toString().replace("-", "");
        var base = Flyway.configure().dataSource(url, user, "").schemas(schema).defaultSchema(schema)
                .locations("classpath:db/migration").target("9").load();
        base.migrate();
        try (var c = DriverManager.getConnection(url, user, "")) {
            c.setSchema(schema);
            sql(c, "INSERT INTO empresas(id,razao_social,ativo) VALUES(1,'A',true),(2,'B',true)");
            sql(c, "INSERT INTO usuario(id,empresa_id,nome_usuario,ativo) VALUES(1,1,'A',true),(2,2,'B',true)");
            sql(c, "INSERT INTO caixas(id,empresa_id,descricao) VALUES(1,1,'A'),(2,2,'B')");
            sql(c, "INSERT INTO vendas(id,empresa_id,usuario_id,data_hora,status,subtotal,desconto,total,forma_pagamento) "
                    + "VALUES(1,1,1,CURRENT_TIMESTAMP,'FATURADA',10,0,10,'DINHEIRO')");
            var atual = Flyway.configure().dataSource(url,user,"").schemas(schema).defaultSchema(schema)
                    .locations("classpath:db/migration").load();
            assertThat(atual.migrate().migrationsExecuted).isEqualTo(1);
            atual.validate();
            assertThat(atual.migrate().migrationsExecuted).isZero();
            assertThat(numero(c,"SELECT count(*) FROM vendas WHERE sessao_caixa_id IS NULL")).isEqualTo(1);
            assertThat(numero(c,"SELECT count(*) FROM movimentacoes_caixa")).isZero();
            sql(c,"INSERT INTO sessoes_caixa(id,empresa_id,caixa_id,usuario_abertura_id,saldo_inicial,data_abertura,status) "
                    + "VALUES(1,1,1,1,100,CURRENT_TIMESTAMP,'ABERTO')");
            sql(c,"UPDATE vendas SET sessao_caixa_id=1 WHERE id=1");
            String insert = "INSERT INTO movimentacoes_caixa(empresa_id,sessao_id,usuario_id,chave_requisicao,tipo,valor,data_hora) "
                    + "VALUES(1,1,1,'11111111-1111-1111-1111-111111111111','SUPRIMENTO',10,CURRENT_TIMESTAMP)";
            sql(c,insert);
            assertThatThrownBy(() -> sql(c,insert)).isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> sql(c,insert.replace("1,1,1,", "2,1,2,")
                    .replace("11111111-1111-1111-1111-111111111111", UUID.randomUUID().toString()))).isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> sql(c,insert.replace("'SUPRIMENTO'", "'VENDA'")
                    .replace("11111111-1111-1111-1111-111111111111", UUID.randomUUID().toString()))).isInstanceOf(SQLException.class);
            c.setAutoCommit(false);
            sql(c,insert.replace("11111111-1111-1111-1111-111111111111", UUID.randomUUID().toString()));
            c.rollback(); c.setAutoCommit(true);
            assertThat(numero(c,"SELECT count(*) FROM movimentacoes_caixa")).isEqualTo(1);
            var factory = new LocalContainerEntityManagerFactoryBean();
            factory.setDataSource(new DriverManagerDataSource(url,user,""));
            factory.setPackagesToScan("br.com.novexa.erp.entity");
            factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
            factory.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto","validate","hibernate.default_schema",schema,
                    "hibernate.physical_naming_strategy","org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy"));
            try { factory.afterPropertiesSet(); } finally { factory.destroy(); }
        }
    }
    private static void sql(Connection c, String sql) throws SQLException {
        try(var s=c.createStatement()){s.execute(sql);}
    }
    private static long numero(Connection c,String sql) throws SQLException {
        try(var s=c.createStatement();var r=s.executeQuery(sql)){r.next();return r.getLong(1);}
    }
}
