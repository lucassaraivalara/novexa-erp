package br.com.novexa.erp.repository;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// PostgreSQL somente quando fornecido um banco descartavel; cada teste usa um schema novo.
class PagamentoMigrationTest {
    private Connection connection;
    private String url;
    private String usuario;
    private String schema;

    @BeforeEach
    void prepararHistoricoNoSchemaAnterior() throws Exception {
        url = System.getProperty("novexa.test.pagamento.jdbc-url",
                "jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE");
        usuario = System.getProperty("novexa.test.pagamento.jdbc-user", "sa");
        connection = DriverManager.getConnection(url, usuario, "");
        schema = "pagamentos_teste_" + UUID.randomUUID().toString().replace("-", "");
        executar("CREATE SCHEMA " + schema);
        connection.setSchema(schema);
        if (postgres()) {
            flywayAte("6").migrate();
        } else {
            for (String migration : new String[]{"V1__baseline_novexa.sql", "V2__cria_movimentacoes_estoque.sql",
                    "V3__cria_vendas_e_lancamentos.sql", "V5__ajusta_vendas_abertas.sql",
                    "V6__consolida_itens_e_faturamento.sql"}) {
                migrarScript(migration);
            }
        }
        executar("INSERT INTO empresas (id,razao_social,ativo) VALUES (1,'Empresa A',true),(2,'Empresa B',true)");
        executar("INSERT INTO usuario (id,empresa_id,nome_usuario,ativo,perfil) "
                + "VALUES (1,1,'Operador A',true,'USUARIO'),(2,2,'Operador B',true,'USUARIO')");
        executar("INSERT INTO produtos (id,empresa_id,nome,unidade_medida,preco_venda,estoque_atual,data_cadastro) "
                + "VALUES (1,1,'Produto','UN',20,10,CURRENT_TIMESTAMP)");
        int id = 0;
        for (String forma : new String[]{"DINHEIRO", "PIX", "CARTAO_DEBITO", "CARTAO_CREDITO"}) {
            id++;
            executar("INSERT INTO vendas (id,empresa_id,usuario_id,chave_requisicao,resumo_requisicao,data_hora,"
                    + "status,subtotal,desconto,total,forma_pagamento,valor_recebido,troco) VALUES (" + id
                    + ",1,1,'" + UUID.randomUUID() + "','historico',TIMESTAMP '2026-09-01 10:00:00',"
                    + "'FATURADA',20,0,20,'" + forma + "',25,5)");
        }
        executar("INSERT INTO vendas (id,empresa_id,usuario_id,data_hora,status,subtotal,desconto,total) "
                + "VALUES (5,1,1,CURRENT_TIMESTAMP,'ABERTA',20,0,20)");
        executar("INSERT INTO lancamentos_financeiros (empresa_id,venda_id,forma_pagamento,situacao,valor,data_hora) "
                + "VALUES (1,1,'DINHEIRO','RECEBIDO',20,TIMESTAMP '2026-09-01 10:05:00')");
    }

    @AfterEach
    void fecharConexao() throws Exception {
        if (connection != null) connection.close();
        // PostgreSQL conserva os schemas aleatorios para inspecao no banco descartavel fornecido.
    }

    @Test
    void migraFaturadasPreservandoVendaFinanceiroEstoqueEDadosHistoricos() throws Exception {
        migrarPagamento();

        assertThat(numero("SELECT count(*) FROM pagamentos")).isEqualTo(4);
        assertThat(numero("SELECT count(*) FROM pagamentos WHERE venda_id=5")).isZero();
        assertThat(numero("SELECT count(*) FROM pagamentos p JOIN vendas v ON v.id=p.venda_id "
                + "WHERE p.empresa_id=v.empresa_id AND p.usuario_id=v.usuario_id "
                + "AND p.chave_requisicao=v.chave_requisicao AND p.forma_pagamento=v.forma_pagamento "
                + "AND p.valor=v.total AND p.sequencia=1 AND p.status='REGISTRADO'")).isEqualTo(4);
        assertThat(numero("SELECT count(*) FROM pagamentos WHERE forma_pagamento='DINHEIRO' "
                + "AND valor=20 AND valor_recebido=25 AND troco=5 "
                + "AND data_hora=TIMESTAMP '2026-09-01 10:05:00'")).isEqualTo(1);
        assertThat(numero("SELECT count(*) FROM pagamentos WHERE forma_pagamento<>'DINHEIRO' "
                + "AND valor_recebido IS NULL AND troco IS NULL "
                + "AND data_hora=TIMESTAMP '2026-09-01 10:00:00'")).isEqualTo(3);
        assertThat(numero("SELECT count(*) FROM vendas WHERE status='FATURADA' "
                + "AND total=20 AND valor_recebido=25 AND troco=5")).isEqualTo(4);
        assertThat(numero("SELECT count(*) FROM vendas WHERE status='ABERTA'")).isEqualTo(1);
        assertThat(numero("SELECT count(*) FROM lancamentos_financeiros "
                + "WHERE valor=20 AND situacao='RECEBIDO'")).isEqualTo(1);
        assertThat(numero("SELECT count(*) FROM movimentacoes_estoque")).isZero();
        assertThat(numero("SELECT estoque_atual FROM produtos WHERE id=1")).isEqualTo(10);

        if (postgres()) {
            flywayAte("7").validate();
            assertThat(flywayAte("7").migrate().migrationsExecuted).isZero();
            flywayAte("8").migrate();
            validarHibernatePostgres();
        }
    }

    @Test
    void modeloPermiteOutroPagamentoDaMesmaVendaComSequenciaDistinta() throws Exception {
        migrarPagamento();
        inserirPagamento(1, 1, 1, 2, "PIX", "5.25", "NULL", "NULL", "REGISTRADO");
        assertThat(numero("SELECT count(*) FROM pagamentos WHERE venda_id=1")).isEqualTo(2);
        assertThat(numero("SELECT count(DISTINCT chave_requisicao) FROM pagamentos WHERE venda_id=1")).isEqualTo(1);
        assertThat(numero("SELECT count(*) FROM pagamentos WHERE venda_id=1 AND sequencia=2 AND valor=5.25")).isEqualTo(1);
    }

    @Test
    void rejeitaDuplicacaoDaMesmaSequenciaDeFechamento() throws Exception {
        migrarPagamento();
        assertThatThrownBy(() -> inserirPagamento(1, 1, 1, 1, "PIX", "20", "NULL", "NULL", "REGISTRADO"))
                .isInstanceOf(SQLException.class);
        assertThat(numero("SELECT count(*) FROM pagamentos WHERE venda_id=1")).isEqualTo(1);
    }

    @ParameterizedTest
    @CsvSource({"2, 1, 2", "1, 1, 2"})
    void bancoRejeitaVendaOuOperadorDeOutroTenant(long empresa, long venda, long operador) throws Exception {
        migrarPagamento();
        assertThatThrownBy(() -> inserirPagamento(empresa, venda, operador, 2, "PIX", "20", "NULL", "NULL", "REGISTRADO"))
                .isInstanceOf(SQLException.class);
        assertThat(numero("SELECT count(*) FROM pagamentos")).isEqualTo(4);
    }

    @ParameterizedTest
    @CsvSource({
            "DINHEIRO, 0, 25, 25",
            "DINHEIRO, -1, 25, 26",
            "DINHEIRO, 20, NULL, NULL",
            "DINHEIRO, 20, 25, NULL",
            "DINHEIRO, 20, 19, -1",
            "DINHEIRO, 20, 25, 4",
            "PIX, 20, 20, 0",
            "CARTAO_DEBITO, 20, 20, NULL",
            "CARTAO_CREDITO, 20, NULL, 0",
            "TRANSFERENCIA, 20, NULL, NULL"
    })
    void bancoRejeitaValoresOuFormasIncompativeis(String forma, String valor, String recebido, String troco) throws Exception {
        migrarPagamento();
        assertThatThrownBy(() -> inserirPagamento(1, 1, 1, 2, forma, valor, recebido, troco, "REGISTRADO"))
                .isInstanceOf(SQLException.class);
        assertThat(numero("SELECT count(*) FROM pagamentos")).isEqualTo(4);
    }

    @ParameterizedTest
    @CsvSource({"0, REGISTRADO", "2, RECEBIDO", "2, A_RECEBER", "2, CANCELADO"})
    void bancoRejeitaSequenciaOuStatusNaoSuportados(int sequencia, String status) throws Exception {
        migrarPagamento();
        assertThatThrownBy(() -> inserirPagamento(1, 1, 1, sequencia, "PIX", "20", "NULL", "NULL", status))
                .isInstanceOf(SQLException.class);
        assertThat(numero("SELECT count(*) FROM pagamentos")).isEqualTo(4);
    }

    @Test
    void historicoIncompletoInterrompeMigrationSemInventarPagamento() throws Exception {
        executar("UPDATE vendas SET chave_requisicao=NULL WHERE id=1");

        assertThatThrownBy(this::migrarPagamento).hasStackTraceContaining("chave_requisicao");

        assertThat(numero("SELECT count(*) FROM vendas WHERE id=1 AND status='FATURADA' AND chave_requisicao IS NULL")).isEqualTo(1);
        assertThat(numero("SELECT count(*) FROM lancamentos_financeiros")).isEqualTo(1);
        assertThat(numero("SELECT estoque_atual FROM produtos WHERE id=1")).isEqualTo(10);
        if (postgres()) {
            // DDL e backfill sao uma unica transacao Flyway no PostgreSQL.
            assertThat(numero("SELECT count(*) FROM information_schema.tables WHERE table_schema='" + schema
                    + "' AND table_name='pagamentos'")).isZero();
            assertThat(numero("SELECT count(*) FROM information_schema.table_constraints WHERE constraint_schema='" + schema
                    + "' AND constraint_name IN ('uk_venda_id_empresa','uk_usuario_id_empresa')")).isZero();
        } else {
            // H2 faz commit de DDL; nao e evidencia de atomicidade da migration PostgreSQL.
            assertThat(numero("SELECT count(*) FROM pagamentos")).isZero();
        }
    }

    @Test
    void v8VinculaHistoricoAoCatalogoGlobalSemRepetirEfeitos() throws Exception {
        migrarPagamento();
        migrarFormas();
        assertThat(numero("SELECT count(*) FROM formas_pagamento")).isEqualTo(6);
        assertThat(numero("SELECT count(*) FROM pagamentos p JOIN formas_pagamento f ON f.id=p.forma_pagamento_id "
                + "WHERE p.forma_pagamento_id=p.venda_id AND p.valor=20 AND p.status='REGISTRADO'")).isEqualTo(4);
        assertThat(numero("SELECT count(*) FROM pagamentos WHERE forma_pagamento='DINHEIRO' AND troco=5")).isEqualTo(1);
        assertThat(numero("SELECT count(*) FROM lancamentos_financeiros")).isEqualTo(1);
        assertThat(numero("SELECT estoque_atual FROM produtos WHERE id=1")).isEqualTo(10);
        assertThat(numero("SELECT count(*) FROM information_schema.columns WHERE table_schema='" + schema
                + "' AND table_name='formas_pagamento' AND column_name='empresa_id'")).isZero();
        executar("INSERT INTO formas_pagamento (descricao,tipo,ativo) VALUES ('PIX adicional','PIX',true)");
        assertThat(numero("SELECT id FROM formas_pagamento WHERE descricao='PIX adicional'")).isGreaterThan(6);
        executar("UPDATE formas_pagamento SET descricao='Dinheiro renomeado',ativo=false WHERE id=1");
        assertThat(numero("SELECT count(*) FROM pagamentos WHERE forma_pagamento_id=1 AND forma_pagamento='DINHEIRO' AND valor=20")).isEqualTo(1);
        if (postgres()) {
            flywayAte("8").validate();
            assertThat(flywayAte("8").migrate().migrationsExecuted).isZero();
            validarHibernatePostgres();
            assertThatThrownBy(() -> executar("INSERT INTO formas_pagamento (descricao,tipo,ativo) VALUES (' pix ','PIX',true)"))
                    .isInstanceOf(SQLException.class);
        }
    }

    @Test
    void v8RejeitaFormaInexistenteNulaEExclusaoDeFormaReferenciada() throws Exception {
        migrarPagamento(); migrarFormas();
        assertThatThrownBy(() -> executar("UPDATE pagamentos SET forma_pagamento_id=999 WHERE id=1"))
                .isInstanceOf(SQLException.class);
        assertThatThrownBy(() -> executar("UPDATE pagamentos SET forma_pagamento_id=NULL WHERE id=1"))
                .isInstanceOf(SQLException.class);
        assertThatThrownBy(() -> executar("DELETE FROM formas_pagamento WHERE id=1"))
                .isInstanceOf(SQLException.class);
        assertThatThrownBy(() -> executar("INSERT INTO formas_pagamento (descricao,tipo) VALUES ('  ','PIX')"))
                .isInstanceOf(SQLException.class);
        assertThatThrownBy(() -> executar("INSERT INTO formas_pagamento (descricao,tipo) VALUES ('Teste','INVALIDO')"))
                .isInstanceOf(SQLException.class);
    }

    @Test
    void v8InterrompeComLegadoDesconhecidoSemInventarVinculo() throws Exception {
        migrarPagamento();
        executar("ALTER TABLE pagamentos DROP CONSTRAINT chk_pagamento_forma");
        executar("UPDATE pagamentos SET forma_pagamento='LEGADO' WHERE forma_pagamento='PIX'");
        assertThatThrownBy(this::migrarFormas).hasStackTraceContaining("forma_pagamento_id");
        assertThat(numero("SELECT count(*) FROM pagamentos WHERE forma_pagamento='LEGADO'")).isEqualTo(1);
        if (postgres()) {
            assertThat(numero("SELECT count(*) FROM information_schema.tables WHERE table_schema='" + schema
                    + "' AND table_name='formas_pagamento'")).isZero();
        }
    }

    private void migrarFormas() throws Exception {
        if (postgres()) {
            flywayAte("8").migrate();
        } else {
            // H2 não suporta índice por expressão nem a sequência criada por BIGSERIAL.
            // O SQL original completo, o índice e a atomicidade são verificados em PostgreSQL.
            String sql = new ClassPathResource("db/migration/V8__cria_formas_pagamento.sql")
                    .getContentAsString(java.nio.charset.StandardCharsets.UTF_8)
                    .replace("CREATE UNIQUE INDEX uk_forma_descricao_normalizada ON formas_pagamento (lower(trim(descricao)));", "")
                    .replace("ALTER SEQUENCE formas_pagamento_id_seq RESTART WITH 7;",
                            "ALTER TABLE formas_pagamento ALTER COLUMN id RESTART WITH 7;");
            ScriptUtils.executeSqlScript(connection, new org.springframework.core.io.ByteArrayResource(
                    sql.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        }
    }

    private void inserirPagamento(long empresa, long venda, long operador, int sequencia, String forma,
                                  String valor, String recebido, String troco, String status) throws SQLException {
        executar("INSERT INTO pagamentos (empresa_id,venda_id,usuario_id,sequencia,chave_requisicao,"
                + "forma_pagamento,valor,status,data_hora,valor_recebido,troco) SELECT "
                + empresa + "," + venda + "," + operador + "," + sequencia + ",chave_requisicao,'"
                + forma + "'," + valor + ",'" + status + "',CURRENT_TIMESTAMP," + recebido + "," + troco
                + " FROM vendas WHERE id=" + venda);
    }

    private void migrarPagamento() {
        if (postgres()) flywayAte("7").migrate();
        else migrarScript("V7__cria_pagamentos.sql");
    }

    private Flyway flywayAte(String versao) {
        return Flyway.configure().dataSource(url, usuario, "").schemas(schema).defaultSchema(schema)
                .locations("classpath:db/migration").target(versao).load();
    }

    private void validarHibernatePostgres() {
        var factory = new LocalContainerEntityManagerFactoryBean();
        factory.setDataSource(new DriverManagerDataSource(url, usuario, ""));
        factory.setPackagesToScan("br.com.novexa.erp.entity");
        factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        factory.setJpaPropertyMap(Map.of(
                "hibernate.hbm2ddl.auto", "validate",
                "hibernate.default_schema", schema,
                "hibernate.physical_naming_strategy", "org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy"));
        try {
            factory.afterPropertiesSet();
            try (var em = factory.getObject().createEntityManager()) {
                assertThat(em.createQuery("select p from PagamentoEntity p").getResultList()).hasSize(4);
            }
        } finally {
            factory.destroy();
        }
    }

    private boolean postgres() { return url.startsWith("jdbc:postgresql:"); }

    private void migrarScript(String arquivo) {
        ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/" + arquivo));
    }

    private void executar(String sql) throws SQLException {
        try (var statement = connection.createStatement()) { statement.execute(sql); }
    }

    private long numero(String sql) throws SQLException {
        try (var statement = connection.createStatement(); var result = statement.executeQuery(sql)) {
            assertThat(result.next()).isTrue();
            return result.getLong(1);
        }
    }
}
