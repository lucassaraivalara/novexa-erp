package br.com.novexa.erp.repository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import java.sql.*;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "novexa.test.saldo-inicial.jdbc-url", matches = "jdbc:postgresql:.*")
class SaldoInicialFinanceiroMigrationTest {
    @Test void v22PreservaHistoricoEProtegeSaldoInicial() throws Exception {
        try (var c = DriverManager.getConnection(System.getProperty("novexa.test.saldo-inicial.jdbc-url"),
                System.getProperty("novexa.test.saldo-inicial.jdbc-user", "postgres"),
                System.getProperty("novexa.test.saldo-inicial.jdbc-password", ""))) {
            String schema = "teste_saldo_inicial_" + UUID.randomUUID().toString().replace("-", "");
            sql(c, "CREATE SCHEMA " + schema);
            try {
                sql(c, "SET search_path TO " + schema);
                sql(c, "CREATE TABLE empresas (id BIGINT PRIMARY KEY)");
                sql(c, "CREATE TABLE usuario (id BIGINT PRIMARY KEY, empresa_id BIGINT, UNIQUE(id,empresa_id))");
                sql(c, "CREATE TABLE contas_bancarias (id BIGINT PRIMARY KEY, empresa_id BIGINT NOT NULL)");
                sql(c, "CREATE TABLE contas_pagar (id BIGINT PRIMARY KEY, empresa_id BIGINT NOT NULL)");
                migrar(c, "V19__cria_contas_e_movimentacoes_financeiras.sql");
                migrar(c, "V20__integra_baixa_conta_pagar_movimentacao_financeira.sql");
                migrar(c, "V21__vincula_conta_financeira_conta_bancaria.sql");
                sql(c, "INSERT INTO empresas VALUES (1),(2)");
                sql(c, "INSERT INTO usuario VALUES (10,1),(20,2)");
                sql(c, "INSERT INTO contas_financeiras (id,empresa_id,nome,tipo,saldo_inicial,saldo_atual,ativo,data_criacao,data_atualizacao) VALUES (1,1,'Legada','BANCO',1000,1400,TRUE,'2026-01-01','2026-01-02')");
                movimento(c, 1, 1, 10, "ENTRADA", "MANUAL", 400);
                migrar(c, "V22__torna_saldo_inicial_auditavel.sql");
                try (var r = c.createStatement().executeQuery("SELECT saldo_inicial,saldo_atual,saldo_inicial_auditado,data_criacao FROM contas_financeiras WHERE id=1")) {
                    assertThat(r.next()).isTrue();
                    assertThat(r.getBigDecimal(1)).isEqualByComparingTo("1000");
                    assertThat(r.getBigDecimal(2)).isEqualByComparingTo("1400");
                    assertThat(r.getBoolean(3)).isFalse();
                    assertThat(r.getTimestamp(4).toLocalDateTime()).isEqualTo(java.time.LocalDate.of(2026, 1, 1).atStartOfDay());
                }
                try (var r = c.createStatement().executeQuery("SELECT origem,valor,usuario_id FROM movimentacoes_financeiras")) {
                    assertThat(r.next()).isTrue(); assertThat(r.getString(1)).isEqualTo("MANUAL");
                    assertThat(r.getBigDecimal(2)).isEqualByComparingTo("400");
                    assertThat(r.getLong(3)).isEqualTo(10); assertThat(r.next()).isFalse();
                }
                sql(c, "INSERT INTO contas_financeiras (id,empresa_id,nome,tipo,saldo_inicial,saldo_atual,saldo_inicial_auditado,ativo,data_criacao,data_atualizacao) VALUES (2,1,'Nova','COFRE',1000,1000,TRUE,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
                assertThatThrownBy(() -> movimento(c, 2, 1, 10, "SAIDA", "SALDO_INICIAL", 1000)).isInstanceOf(SQLException.class);
                assertThatThrownBy(() -> movimento(c, 2, 2, 20, "ENTRADA", "SALDO_INICIAL", 1000)).isInstanceOf(SQLException.class);
                assertThatThrownBy(() -> movimento(c, 2, 1, 20, "ENTRADA", "SALDO_INICIAL", 1000)).isInstanceOf(SQLException.class);
                assertThatThrownBy(() -> movimento(c, 2, 1, 10, "ENTRADA", "SALDO_INICIAL", 0)).isInstanceOf(SQLException.class);
                movimento(c, 2, 1, 10, "ENTRADA", "SALDO_INICIAL", 1000);
                assertThatThrownBy(() -> movimento(c, 2, 1, 10, "ENTRADA", "SALDO_INICIAL", 1000)).isInstanceOf(SQLException.class);
                assertThatThrownBy(() -> sql(c, "UPDATE movimentacoes_financeiras SET estornada=TRUE,data_estorno=CURRENT_TIMESTAMP,usuario_estorno_id=10,motivo_estorno='Teste' WHERE origem='SALDO_INICIAL'")).isInstanceOf(SQLException.class);
            } finally {
                sql(c, "SET search_path TO public");
                sql(c, "DROP SCHEMA " + schema + " CASCADE");
            }
        }
    }

    private void movimento(Connection c, long conta, long empresa, long usuario, String tipo, String origem, int valor) throws SQLException {
        try (var s = c.prepareStatement("INSERT INTO movimentacoes_financeiras (empresa_id,conta_financeira_id,tipo,origem,descricao,valor,data_movimento,usuario_id,data_criacao) VALUES (?,?,?,?,'Teste',?,CURRENT_DATE,?,CURRENT_TIMESTAMP)")) {
            s.setLong(1, empresa); s.setLong(2, conta); s.setString(3, tipo); s.setString(4, origem);
            s.setInt(5, valor); s.setLong(6, usuario); s.executeUpdate();
        }
    }
    private void migrar(Connection c, String arquivo) {
        ScriptUtils.executeSqlScript(c, new ClassPathResource("db/migration/" + arquivo));
    }
    private void sql(Connection c, String comando) throws SQLException {
        try (var s = c.createStatement()) { s.execute(comando); }
    }
}
