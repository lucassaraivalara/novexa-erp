package br.com.novexa.erp.repository;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.core.io.*;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.util.Map;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

class SessaoCaixaMigrationTest {
    Connection connection;
    String url, usuario, schema;

    @BeforeEach
    void preparar() throws Exception {
        url = System.getProperty("novexa.test.caixa.jdbc-url", "jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE");
        usuario = System.getProperty("novexa.test.caixa.jdbc-user", "sa");
        connection = DriverManager.getConnection(url, usuario, "");
        schema = "caixa_teste_" + UUID.randomUUID().toString().replace("-", "");
        sql("CREATE SCHEMA " + schema);
        connection.setSchema(schema);
        if (postgres()) {
            flyway().migrate();
        } else {
            // H2 exercita a V9 contra os vínculos necessários. A cadeia completa é validada no PostgreSQL.
            sql("CREATE TABLE empresas(id BIGINT PRIMARY KEY)");
            sql("CREATE TABLE usuario(id BIGINT PRIMARY KEY, empresa_id BIGINT, UNIQUE(id,empresa_id))");
            sql("CREATE TABLE caixas(id BIGINT PRIMARY KEY, empresa_id BIGINT)");
            String script = new ClassPathResource("db/migration/V9__cria_sessoes_caixa.sql")
                    .getContentAsString(StandardCharsets.UTF_8)
                    .replace("CREATE UNIQUE INDEX uk_sessao_caixa_aberta ON sessoes_caixa(caixa_id) WHERE status = 'ABERTO';",
                            "ALTER TABLE sessoes_caixa ADD aberta BIGINT GENERATED ALWAYS AS (CASE WHEN status = 'ABERTO' THEN caixa_id ELSE NULL END);"
                            + "CREATE UNIQUE INDEX uk_sessao_caixa_aberta ON sessoes_caixa(aberta);");
            ScriptUtils.executeSqlScript(connection, new ByteArrayResource(script.getBytes(StandardCharsets.UTF_8)));
        }
        if (postgres()) {
            sql("INSERT INTO empresas(id,razao_social,ativo) VALUES(1,'A',true),(2,'B',true)");
            sql("INSERT INTO usuario(id,empresa_id,nome_usuario,ativo) VALUES(1,1,'A',true),(2,2,'B',true)");
            sql("INSERT INTO caixas(id,empresa_id,descricao) VALUES(1,1,'A'),(2,2,'B')");
        } else {
            sql("INSERT INTO empresas VALUES(1),(2)");
            sql("INSERT INTO usuario VALUES(1,1),(2,2)");
            sql("INSERT INTO caixas VALUES(1,1),(2,2)");
        }
    }

    @AfterEach
    void fechar() throws Exception { if (connection != null) connection.close(); }

    @Test
    void unicaAbertaPorCaixaPreservaMultiplasFechadasEOutroCaixa() throws Exception {
        abrir(1, 1, 1);
        assertThatThrownBy(() -> abrir(1, 1, 1)).isInstanceOf(SQLException.class);
        abrir(2, 2, 2);
        for (int i = 0; i < 2; i++) {
            sql("UPDATE sessoes_caixa SET status='FECHADO',saldo_final=8.25,usuario_fechamento_id=1,"
                    + "data_fechamento=CURRENT_TIMESTAMP WHERE caixa_id=1 AND status='ABERTO'");
            abrir(1, 1, 1);
        }
        assertThat(numero("SELECT count(*) FROM sessoes_caixa WHERE caixa_id=1")).isEqualTo(3);
        assertThat(numero("SELECT count(*) FROM sessoes_caixa WHERE status='ABERTO'")).isEqualTo(2);
    }

    @Test
    void bancoRejeitaVinculosEntreEmpresasEFechamentoIncompleto() throws Exception {
        assertThatThrownBy(() -> abrir(1, 2, 2)).isInstanceOf(SQLException.class);
        assertThatThrownBy(() -> abrir(1, 1, 2)).isInstanceOf(SQLException.class);
        abrir(1, 1, 1);
        assertThatThrownBy(() -> sql("UPDATE sessoes_caixa SET status='FECHADO'")).isInstanceOf(SQLException.class);
        assertThatThrownBy(() -> sql("UPDATE sessoes_caixa SET saldo_inicial=-1")).isInstanceOf(SQLException.class);
        assertThatThrownBy(() -> sql("UPDATE sessoes_caixa SET status='FECHADO',saldo_final=8,"
                + "usuario_fechamento_id=2,data_fechamento=CURRENT_TIMESTAMP")).isInstanceOf(SQLException.class);
        assertThat(numero("SELECT count(*) FROM sessoes_caixa WHERE status='ABERTO'")).isEqualTo(1);
    }

    @Test
    void rollbackNaoDeixaSessaoParcial() throws Exception {
        connection.setAutoCommit(false);
        abrir(1, 1, 1);
        connection.rollback();
        connection.setAutoCommit(true);
        assertThat(numero("SELECT count(*) FROM sessoes_caixa")).isZero();
        abrir(1, 1, 1);
        assertThat(numero("SELECT count(*) FROM sessoes_caixa")).isEqualTo(1);
    }

    @Test
    void schemaMigradoCompativelComHibernate() throws Exception {
        assertThat(numero("SELECT count(*) FROM sessoes_caixa")).isZero();
        if (!postgres()) return;
        flyway().validate();
        assertThat(flyway().migrate().migrationsExecuted).isZero();
        var factory = new LocalContainerEntityManagerFactoryBean();
        factory.setDataSource(new DriverManagerDataSource(url, usuario, ""));
        factory.setPackagesToScan("br.com.novexa.erp.entity");
        factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        factory.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto", "validate", "hibernate.default_schema", schema,
                "hibernate.physical_naming_strategy", "org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy"));
        try { factory.afterPropertiesSet(); } finally { factory.destroy(); }
    }

    private Flyway flyway() {
        return Flyway.configure().dataSource(url, usuario, "").schemas(schema).defaultSchema(schema)
                .locations("classpath:db/migration").target("9").load();
    }
    private boolean postgres() { return url.startsWith("jdbc:postgresql:"); }
    private void abrir(long caixa, long empresa, long operador) throws SQLException {
        sql("INSERT INTO sessoes_caixa(caixa_id,empresa_id,usuario_abertura_id,saldo_inicial,data_abertura,status) VALUES("
                + caixa + "," + empresa + "," + operador + ",10.25,CURRENT_TIMESTAMP,'ABERTO')");
    }
    private void sql(String sql) throws SQLException {
        try (var statement = connection.createStatement()) { statement.execute(sql); }
    }
    private long numero(String sql) throws SQLException {
        try (var statement = connection.createStatement(); var result = statement.executeQuery(sql)) {
            assertThat(result.next()).isTrue(); return result.getLong(1);
        }
    }
}
