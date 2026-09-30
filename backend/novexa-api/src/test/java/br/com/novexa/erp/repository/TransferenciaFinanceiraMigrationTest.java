package br.com.novexa.erp.repository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import java.sql.*;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "novexa.test.transferencias.jdbc-url", matches = "jdbc:postgresql:.*")
class TransferenciaFinanceiraMigrationTest {
    @Test void v23PreservaDadosEProtegeTenantChaveEVinculos() throws Exception {
        try (var c = DriverManager.getConnection(System.getProperty("novexa.test.transferencias.jdbc-url"),
                System.getProperty("novexa.test.transferencias.jdbc-user", "postgres"),
                System.getProperty("novexa.test.transferencias.jdbc-password", ""))) {
            String schema = "teste_transferencia_" + UUID.randomUUID().toString().replace("-", "");
            sql(c, "CREATE SCHEMA " + schema);
            try {
                sql(c, "SET search_path TO " + schema);
                sql(c, "CREATE TABLE empresas (id BIGINT PRIMARY KEY)");
                sql(c, "CREATE TABLE usuario (id BIGINT PRIMARY KEY, empresa_id BIGINT, UNIQUE(id,empresa_id))");
                sql(c, "CREATE TABLE contas_bancarias (id BIGINT PRIMARY KEY, empresa_id BIGINT NOT NULL)");
                sql(c, "CREATE TABLE contas_pagar (id BIGINT PRIMARY KEY, empresa_id BIGINT NOT NULL)");
                for (String arquivo : new String[]{"V19__cria_contas_e_movimentacoes_financeiras.sql",
                        "V20__integra_baixa_conta_pagar_movimentacao_financeira.sql",
                        "V21__vincula_conta_financeira_conta_bancaria.sql", "V22__torna_saldo_inicial_auditavel.sql"})
                    migrar(c, arquivo);
                sql(c, "INSERT INTO empresas VALUES (1),(2)");
                sql(c, "INSERT INTO usuario VALUES (10,1),(20,2)");
                sql(c, "INSERT INTO contas_financeiras (id,empresa_id,nome,tipo,saldo_inicial,saldo_atual,ativo,data_criacao,data_atualizacao) VALUES "
                        + "(1,1,'Origem','COFRE',1000,1000,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),"
                        + "(2,1,'Destino','OUTROS',200,200,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),"
                        + "(3,2,'Outra origem','COFRE',1000,1000,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),"
                        + "(4,2,'Outro destino','OUTROS',200,200,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
                sql(c, "INSERT INTO movimentacoes_financeiras (empresa_id,conta_financeira_id,tipo,origem,descricao,valor,data_movimento,usuario_id,data_criacao) VALUES (1,1,'ENTRADA','SALDO_INICIAL','Inicial',1000,CURRENT_DATE,10,CURRENT_TIMESTAMP)");
                migrar(c, "V23__cria_transferencias_financeiras.sql");
                try (var s = c.createStatement(); var r = s.executeQuery("SELECT saldo_atual,saldo_inicial_auditado FROM contas_financeiras WHERE id=1")) {
                    assertThat(r.next()).isTrue(); assertThat(r.getBigDecimal(1)).isEqualByComparingTo("1000");
                    assertThat(r.getBoolean(2)).isFalse();
                }
                assertThat(contar(c, "movimentacoes_financeiras")).isEqualTo(1);
                try (var s = c.createStatement(); var r = s.executeQuery("SELECT origem,transferencia_id FROM movimentacoes_financeiras")) {
                    assertThat(r.next()).isTrue(); assertThat(r.getString(1)).isEqualTo("SALDO_INICIAL");
                    assertThat(r.getObject(2)).isNull();
                }
                UUID chave = UUID.randomUUID();
                transferencia(c, 1, 1, 2, 10, 100, chave);
                assertThatThrownBy(() -> transferencia(c, 1, 1, 2, 10, 100, chave)).isInstanceOf(SQLException.class);
                transferencia(c, 2, 3, 4, 20, 100, chave);
                for (int valor : new int[]{0, -1})
                    assertThatThrownBy(() -> transferencia(c, 1, 1, 2, 10, valor, UUID.randomUUID())).isInstanceOf(SQLException.class);
                assertThatThrownBy(() -> transferencia(c, 1, 1, 1, 10, 10, UUID.randomUUID())).isInstanceOf(SQLException.class);
                assertThatThrownBy(() -> transferencia(c, 1, 3, 2, 10, 10, UUID.randomUUID())).isInstanceOf(SQLException.class);
                assertThatThrownBy(() -> transferencia(c, 1, 1, 3, 10, 10, UUID.randomUUID())).isInstanceOf(SQLException.class);
                assertThatThrownBy(() -> transferencia(c, 1, 1, 2, 20, 10, UUID.randomUUID())).isInstanceOf(SQLException.class);
                long id;
                try (var s = c.createStatement(); var r = s.executeQuery("SELECT id FROM transferencias_financeiras WHERE empresa_id=1")) {
                    assertThat(r.next()).isTrue(); id = r.getLong(1);
                }
                movimento(c, 1, 1, 10, "SAIDA", "TRANSFERENCIA", id);
                movimento(c, 2, 1, 10, "ENTRADA", "TRANSFERENCIA", id);
                assertThatThrownBy(() -> movimento(c, 1, 1, 10, "SAIDA", "TRANSFERENCIA", id)).isInstanceOf(SQLException.class);
                assertThatThrownBy(() -> movimento(c, 3, 2, 20, "SAIDA", "TRANSFERENCIA", id)).isInstanceOf(SQLException.class);
                assertThatThrownBy(() -> movimento(c, 1, 1, 10, "SAIDA", "TRANSFERENCIA", 9999L)).isInstanceOf(SQLException.class);
                assertThatThrownBy(() -> movimento(c, 1, 1, 10, "SAIDA", "TRANSFERENCIA", null)).isInstanceOf(SQLException.class);
                for (String origem : new String[]{"MANUAL", "CONTAS_A_PAGAR", "SALDO_INICIAL"})
                    assertThatThrownBy(() -> movimento(c, 2, 1, 10, "ENTRADA", origem, id)).isInstanceOf(SQLException.class);
                assertThatThrownBy(() -> sql(c, "UPDATE transferencias_financeiras SET status='ESTORNADA',data_estorno=CURRENT_TIMESTAMP,usuario_estorno_id=20,motivo_estorno='Teste' WHERE id=" + id)).isInstanceOf(SQLException.class);
                assertThatThrownBy(() -> sql(c, "UPDATE transferencias_financeiras SET status='ESTORNADA' WHERE id=" + id)).isInstanceOf(SQLException.class);
                assertThat(contar(c, "transferencias_financeiras")).isEqualTo(2);
                assertThat(contar(c, "movimentacoes_financeiras")).isEqualTo(3);
            } finally {
                sql(c, "SET search_path TO public");
                sql(c, "DROP SCHEMA " + schema + " CASCADE");
            }
        }
    }

    private void transferencia(Connection c, long empresa, long origem, long destino, long usuario, int valor, UUID chave) throws SQLException {
        try (var s = c.prepareStatement("INSERT INTO transferencias_financeiras (empresa_id,conta_origem_id,conta_destino_id,usuario_id,valor,chave_requisicao,status,data_movimento,data_criacao) VALUES (?,?,?,?,?,?,'CONCLUIDA',CURRENT_DATE,CURRENT_TIMESTAMP)")) {
            s.setLong(1, empresa); s.setLong(2, origem); s.setLong(3, destino); s.setLong(4, usuario);
            s.setInt(5, valor); s.setObject(6, chave); s.executeUpdate();
        }
    }
    private void movimento(Connection c, long conta, long empresa, long usuario, String tipo, String origem, Long transferencia) throws SQLException {
        try (var s = c.prepareStatement("INSERT INTO movimentacoes_financeiras (empresa_id,conta_financeira_id,tipo,origem,descricao,valor,data_movimento,usuario_id,data_criacao,transferencia_id) VALUES (?,?,?,?,'Teste',100,CURRENT_DATE,?,CURRENT_TIMESTAMP,?)")) {
            s.setLong(1, empresa); s.setLong(2, conta); s.setString(3, tipo); s.setString(4, origem);
            s.setLong(5, usuario);
            s.setObject(6, transferencia);
            s.executeUpdate();
        }
    }
    private long contar(Connection c, String tabela) throws SQLException {
        try (var s = c.createStatement(); var r = s.executeQuery("SELECT count(*) FROM " + tabela)) {
            r.next(); return r.getLong(1);
        }
    }
    private void migrar(Connection c, String arquivo) { ScriptUtils.executeSqlScript(c, new ClassPathResource("db/migration/" + arquivo)); }
    private void sql(Connection c, String comando) throws SQLException { try (var s = c.createStatement()) { s.execute(comando); } }
}
