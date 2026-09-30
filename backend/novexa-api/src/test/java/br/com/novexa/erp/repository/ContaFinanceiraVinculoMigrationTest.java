package br.com.novexa.erp.repository;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import java.sql.*;
import static org.assertj.core.api.Assertions.*;

class ContaFinanceiraVinculoMigrationTest {
    @Test void v21PreservaLegadosEProtegeVinculos() throws Exception {
        try (var c = DriverManager.getConnection(
                System.getProperty("novexa.test.financeira.jdbc-url", "jdbc:h2:mem:financeira-v21;MODE=PostgreSQL"),
                System.getProperty("novexa.test.financeira.jdbc-user", "sa"),
                System.getProperty("novexa.test.financeira.jdbc-password", ""))) {
            sql(c, "CREATE TABLE empresas (id BIGINT PRIMARY KEY)");
            sql(c, "CREATE TABLE usuario (id BIGINT PRIMARY KEY, empresa_id BIGINT, UNIQUE(id,empresa_id))");
            sql(c, "CREATE TABLE contas_bancarias (id BIGINT PRIMARY KEY, empresa_id BIGINT NOT NULL)");
            ScriptUtils.executeSqlScript(c, new ClassPathResource("db/migration/V19__cria_contas_e_movimentacoes_financeiras.sql"));
            sql(c, "INSERT INTO empresas VALUES (1),(2)");
            sql(c, "INSERT INTO contas_bancarias VALUES (10,1),(20,2)");
            for (String tipo : new String[]{"BANCO", "CAIXA", "ADQUIRENTE", "COFRE"})
                sql(c, "INSERT INTO contas_financeiras (empresa_id,nome,tipo,saldo_inicial,saldo_atual,ativo,data_criacao,data_atualizacao) VALUES (1,'Legada','" + tipo + "',100,125,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
            ScriptUtils.executeSqlScript(c, new ClassPathResource("db/migration/V21__vincula_conta_financeira_conta_bancaria.sql"));
            try (var r = c.createStatement().executeQuery("SELECT COUNT(*),SUM(saldo_atual),COUNT(conta_bancaria_id) FROM contas_financeiras")) {
                r.next(); assertThat(r.getInt(1)).isEqualTo(4);
                assertThat(r.getBigDecimal(2)).isEqualByComparingTo("500");
                assertThat(r.getInt(3)).isZero();
            }
            assertThatThrownBy(() -> sql(c, "UPDATE contas_financeiras SET conta_bancaria_id=20 WHERE id=1")).isInstanceOf(SQLException.class);
            sql(c, "UPDATE contas_financeiras SET conta_bancaria_id=10 WHERE id=1");
            assertThatThrownBy(() -> sql(c, "UPDATE contas_financeiras SET tipo='BANCO',conta_bancaria_id=10 WHERE id=4")).isInstanceOf(SQLException.class);
            sql(c, "UPDATE contas_financeiras SET conta_bancaria_id=NULL WHERE id=1");
            assertThatThrownBy(() -> sql(c, "UPDATE contas_financeiras SET conta_bancaria_id=10 WHERE id=4")).isInstanceOf(SQLException.class);
        }
    }
    private void sql(Connection c, String sql) throws SQLException {
        try (var s = c.createStatement()) { s.execute(sql); }
    }
}
