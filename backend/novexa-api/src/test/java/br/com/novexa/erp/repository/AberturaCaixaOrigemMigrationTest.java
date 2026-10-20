package br.com.novexa.erp.repository;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;

import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AberturaCaixaOrigemMigrationTest {
    Connection conn;
    String schema;

    @BeforeEach
    void setup() throws Exception {
        conn = DriverManager.getConnection("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE", "sa", "");
        schema = "mig_teste_" + UUID.randomUUID().toString().replace("-", "");
        conn.createStatement().execute("CREATE SCHEMA " + schema);
        conn.setSchema(schema);

        // Estruturas minimas necessarias para as FKs de V48
        conn.createStatement().execute("CREATE TABLE empresas (id BIGINT PRIMARY KEY)");
        conn.createStatement().execute("CREATE TABLE usuario (id BIGINT, empresa_id BIGINT, PRIMARY KEY (id), UNIQUE (id, empresa_id))");
        conn.createStatement().execute("CREATE TABLE sessoes_caixa (id BIGINT, empresa_id BIGINT, caixa_id BIGINT, PRIMARY KEY (id), UNIQUE (id, empresa_id))");
        conn.createStatement().execute("CREATE TABLE contas_financeiras (id BIGINT, empresa_id BIGINT, PRIMARY KEY (id), UNIQUE (id, empresa_id))");
        conn.createStatement().execute("CREATE TABLE movimentacoes_financeiras (id BIGINT, empresa_id BIGINT, PRIMARY KEY (id), UNIQUE (id, empresa_id))");

        String script = new ClassPathResource("db/migration/V48__integra_origem_abertura_caixa.sql")
                .getContentAsString(StandardCharsets.UTF_8);
        ScriptUtils.executeSqlScript(conn, new org.springframework.core.io.ByteArrayResource(script.getBytes(StandardCharsets.UTF_8)));

        // Carga de teste
        conn.createStatement().execute("INSERT INTO empresas VALUES (1), (2)");
        conn.createStatement().execute("INSERT INTO usuario VALUES (10, 1), (20, 2)");
        conn.createStatement().execute("INSERT INTO sessoes_caixa VALUES (100, 1, 1), (101, 1, 1), (102, 1, 1), (103, 1, 2), (200, 2, 3)");
        conn.createStatement().execute("INSERT INTO contas_financeiras VALUES (500, 1), (600, 2)");
        conn.createStatement().execute("INSERT INTO movimentacoes_financeiras VALUES (900, 1), (901, 2)");
    }

    @AfterEach
    void tearDown() throws SQLException {
        if (conn != null && !conn.isClosed()) {
            conn.close();
        }
    }

    @Test
    void tabelaCriadaEUnicidadeOrigemTrocoProtegeContraDuploConsumo() throws Exception {
        // Inserir abertura com troco herdado da sessao 100
        var ps = conn.prepareStatement("""
            INSERT INTO aberturas_caixa_origem (
                caixa_id, empresa_id, sessao_id, sessao_origem_troco_id, conta_cofre_id, movimento_financeiro_id,
                usuario_id, chave_requisicao, valor_troco_herdado, valor_retirado_cofre, valor_aporte_externo,
                observacao_aporte, data_criacao
            ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """);
        ps.setLong(1, 1);
        ps.setLong(2, 101); // sessao criada
        ps.setLong(3, 100); // origem troco
        ps.setNull(4, java.sql.Types.BIGINT);
        ps.setNull(5, java.sql.Types.BIGINT);
        ps.setLong(6, 10);
        ps.setObject(7, UUID.randomUUID());
        ps.setBigDecimal(8, new java.math.BigDecimal("70.00"));
        ps.setBigDecimal(9, java.math.BigDecimal.ZERO);
        ps.setBigDecimal(10, java.math.BigDecimal.ZERO);
        ps.setString(11, null);
        ps.executeUpdate();

        // Tentar consumir novamente a mesma sessao de origem (100) em outra sessao deve violar uk_abertura_origem_troco
        var ps2 = conn.prepareStatement("""
            INSERT INTO aberturas_caixa_origem (
                caixa_id, empresa_id, sessao_id, sessao_origem_troco_id, conta_cofre_id, movimento_financeiro_id,
                usuario_id, chave_requisicao, valor_troco_herdado, valor_retirado_cofre, valor_aporte_externo,
                observacao_aporte, data_criacao
            ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """);
        ps2.setLong(1, 1);
        ps2.setLong(2, 102); // outra sessao
        ps2.setLong(3, 100); // MESMA ORIGEM TROCO
        ps2.setNull(4, java.sql.Types.BIGINT);
        ps2.setNull(5, java.sql.Types.BIGINT);
        ps2.setLong(6, 10);
        ps2.setObject(7, UUID.randomUUID());
        ps2.setBigDecimal(8, new java.math.BigDecimal("70.00"));
        ps2.setBigDecimal(9, java.math.BigDecimal.ZERO);
        ps2.setBigDecimal(10, java.math.BigDecimal.ZERO);
        ps2.setString(11, null);

        assertThatThrownBy(ps2::executeUpdate)
                .isInstanceOf(SQLException.class).hasMessageContaining("uk_abertura_origem_troco");
    }
}
