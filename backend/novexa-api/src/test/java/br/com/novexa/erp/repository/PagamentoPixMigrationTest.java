package br.com.novexa.erp.repository;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.sql.*;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "novexa.test.pagamento-pix.jdbc-url", matches = "jdbc:postgresql:.*")
class PagamentoPixMigrationTest {
    @Test void v28ProtegeUnicidadeTenantEOrigemPreservandoLegado() throws Exception {
        String url = System.getProperty("novexa.test.pagamento-pix.jdbc-url");
        String user = System.getProperty("novexa.test.pagamento-pix.jdbc-user", "postgres");
        String password = System.getProperty("novexa.test.pagamento-pix.jdbc-password", "");
        String schema = "teste_pagamento_pix_" + UUID.randomUUID().toString().replace("-", "");
        try (var c = DriverManager.getConnection(url, user, password)) {
            sql(c, "CREATE SCHEMA " + schema);
            try {
                sql(c, "SET search_path TO " + schema);
                Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema).target("27").load().migrate();
                sql(c, "INSERT INTO empresas(id,razao_social) VALUES (1,'A'),(2,'B')");
                sql(c, "INSERT INTO usuario(id,empresa_id) VALUES (1,1),(2,2)");
                sql(c, "INSERT INTO contas_financeiras(id,empresa_id,nome,tipo,saldo_inicial,saldo_atual,ativo,data_criacao,data_atualizacao) VALUES "
                        + "(1,1,'Banco A','BANCO',100,100,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),"
                        + "(2,2,'Banco B','BANCO',100,100,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
                sql(c, "INSERT INTO vendas(id,empresa_id,usuario_id,data_hora,status) VALUES (1,1,1,CURRENT_TIMESTAMP,'FATURADA')");
                sql(c, "INSERT INTO pagamentos(id,empresa_id,venda_id,usuario_id,sequencia,chave_requisicao,forma_pagamento,forma_pagamento_id,valor,status,data_hora,configuracao_tipo,configuracao_conta_financeira_destino_id) VALUES "
                        + "(1,1,1,1,1,'" + UUID.randomUUID() + "','PIX',2,20,'REGISTRADO',CURRENT_TIMESTAMP,'PIX',1)");
                sql(c, "INSERT INTO movimentacoes_financeiras(empresa_id,conta_financeira_id,tipo,origem,descricao,valor,data_movimento,usuario_id,data_criacao) VALUES (1,1,'ENTRADA','MANUAL','Anterior',10,CURRENT_DATE,1,CURRENT_TIMESTAMP)");
                var result = Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema).target("28").load().migrate();
                assertThat(result.migrationsExecuted).isEqualTo(1);
                try (var s = c.createStatement(); var r = s.executeQuery("SELECT origem,pagamento_id FROM movimentacoes_financeiras")) {
                    assertThat(r.next()).isTrue(); assertThat(r.getString(1)).isEqualTo("MANUAL"); assertThat(r.getObject(2)).isNull();
                    assertThat(r.next()).isFalse();
                }
                assertThatThrownBy(() -> movimento(c, 1, "PAGAMENTO_PIX", "ENTRADA", null)).isInstanceOf(SQLException.class);
                assertThatThrownBy(() -> movimento(c, 1, "PAGAMENTO_PIX", "SAIDA", 1L)).isInstanceOf(SQLException.class);
                assertThatThrownBy(() -> movimento(c, 2, "PAGAMENTO_PIX", "ENTRADA", 1L)).isInstanceOf(SQLException.class);
                assertThatThrownBy(() -> movimento(c, 1, "PAGAMENTO_PIX", "ENTRADA", 999L)).isInstanceOf(SQLException.class);
                for (String origem : new String[]{"MANUAL", "CONTAS_A_PAGAR", "SALDO_INICIAL"})
                    assertThatThrownBy(() -> movimento(c, 1, origem, "ENTRADA", 1L)).isInstanceOf(SQLException.class);
                movimento(c, 1, "PAGAMENTO_PIX", "ENTRADA", 1L);
                assertThatThrownBy(() -> movimento(c, 1, "PAGAMENTO_PIX", "ENTRADA", 1L)).isInstanceOf(SQLException.class);
                try (var s = c.createStatement(); var r = s.executeQuery("SELECT count(*) FROM movimentacoes_financeiras WHERE pagamento_id=1")) {
                    assertThat(r.next()).isTrue(); assertThat(r.getLong(1)).isEqualTo(1);
                }
            } finally {
                sql(c, "SET search_path TO public"); sql(c, "DROP SCHEMA " + schema + " CASCADE");
            }
        }
    }
    private void movimento(Connection c, long empresa, String origem, String tipo, Long pagamento) throws SQLException {
        try (var s = c.prepareStatement("INSERT INTO movimentacoes_financeiras(empresa_id,conta_financeira_id,usuario_id,origem,tipo,pagamento_id,descricao,valor,data_movimento,data_criacao) VALUES (?,?,?,?,?,?,'PIX',20,CURRENT_DATE,CURRENT_TIMESTAMP)")) {
            s.setLong(1, empresa); s.setLong(2, empresa); s.setLong(3, empresa); s.setString(4, origem); s.setString(5, tipo);
            s.setObject(6, pagamento); s.executeUpdate();
        }
    }
    private void sql(Connection c, String comando) throws SQLException { try (var s = c.createStatement()) { s.execute(comando); } }
}
