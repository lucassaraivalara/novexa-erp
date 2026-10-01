package br.com.novexa.erp.repository;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.sql.*;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "novexa.test.pagamento-snapshot.jdbc-url", matches = "jdbc:postgresql:.*")
class PagamentoSnapshotMigrationTest {
    @Test void v27PreservaHistoricoSemBackfillEProtegeDestinoPorEmpresa() throws Exception {
        String url = System.getProperty("novexa.test.pagamento-snapshot.jdbc-url");
        String user = System.getProperty("novexa.test.pagamento-snapshot.jdbc-user", "postgres");
        String password = System.getProperty("novexa.test.pagamento-snapshot.jdbc-password", "");
        String schema = "teste_pagamento_snapshot_" + UUID.randomUUID().toString().replace("-", "");
        try (var c = DriverManager.getConnection(url, user, password)) {
            sql(c, "CREATE SCHEMA " + schema);
            try {
                sql(c, "SET search_path TO " + schema);
                Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema).target("26").load().migrate();
                sql(c, "INSERT INTO empresas(id,razao_social) VALUES (1,'A'),(2,'B')");
                sql(c, "INSERT INTO usuario(id,empresa_id) VALUES (1,1)");
                sql(c, "INSERT INTO contas_financeiras(id,empresa_id,nome,tipo,saldo_inicial,saldo_atual,ativo,data_criacao,data_atualizacao) VALUES "
                        + "(1,1,'Banco original','BANCO',100,100,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),"
                        + "(2,2,'Banco externo','BANCO',200,200,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
                sql(c, "INSERT INTO configuracoes_formas_pagamento_empresa(id,empresa_id,forma_pagamento_id,tipo,nome_exibicao,conta_financeira_destino_id,data_criacao,data_atualizacao) VALUES "
                        + "(1,1,2,'PIX','PIX original',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
                String chave = UUID.randomUUID().toString();
                sql(c, "INSERT INTO vendas(id,empresa_id,usuario_id,chave_requisicao,resumo_requisicao,data_hora,status,subtotal,desconto,total,forma_pagamento,valor_recebido,troco,configuracao_forma_pagamento_id) VALUES "
                        + "(1,1,1,'" + chave + "','legado',CURRENT_TIMESTAMP,'FATURADA',10,0,10,'PIX',10,0,1)");
                sql(c, "INSERT INTO pagamentos(id,empresa_id,venda_id,usuario_id,sequencia,chave_requisicao,forma_pagamento,forma_pagamento_id,valor,status,data_hora,configuracao_forma_pagamento_id) VALUES "
                        + "(1,1,1,1,1,'" + chave + "','PIX',2,10,'REGISTRADO',CURRENT_TIMESTAMP,NULL),"
                        + "(2,1,1,1,2,'" + chave + "','PIX',2,10,'REGISTRADO',CURRENT_TIMESTAMP,1)");
                var result = Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema).target("27").load().migrate();
                assertThat(result.migrationsExecuted).isEqualTo(1);
                try (var s = c.createStatement(); var r = s.executeQuery("SELECT id,configuracao_nome_exibicao,configuracao_tipo,configuracao_conta_financeira_destino_id,configuracao_conta_financeira_destino_nome,chave_requisicao,valor FROM pagamentos ORDER BY id")) {
                    for (long id : new long[]{1, 2}) {
                        assertThat(r.next()).isTrue(); assertThat(r.getLong(1)).isEqualTo(id);
                        for (int coluna = 2; coluna <= 5; coluna++) assertThat(r.getObject(coluna)).isNull();
                        assertThat(r.getString(6)).isEqualTo(chave); assertThat(r.getBigDecimal(7)).isEqualByComparingTo("10");
                    }
                    assertThat(r.next()).isFalse();
                }
                for (long destino : new long[]{2, 999})
                    assertThatThrownBy(() -> sql(c, "UPDATE pagamentos SET configuracao_conta_financeira_destino_id=" + destino + " WHERE id=2"))
                            .isInstanceOf(SQLException.class);
                sql(c, "UPDATE contas_financeiras SET nome=repeat('N',150) WHERE id=1");
                sql(c, "UPDATE pagamentos SET configuracao_nome_exibicao='PIX original',configuracao_tipo='PIX',configuracao_conta_financeira_destino_id=1,configuracao_conta_financeira_destino_nome=repeat('N',150) WHERE id=2");
                sql(c, "UPDATE configuracoes_formas_pagamento_empresa SET nome_exibicao='PIX renomeado' WHERE id=1");
                sql(c, "UPDATE contas_financeiras SET nome='Banco renomeado' WHERE id=1");
                try (var s = c.createStatement(); var r = s.executeQuery("SELECT configuracao_nome_exibicao,configuracao_conta_financeira_destino_nome FROM pagamentos WHERE id=2")) {
                    assertThat(r.next()).isTrue(); assertThat(r.getString(1)).isEqualTo("PIX original");
                    assertThat(r.getString(2)).isEqualTo("N".repeat(150));
                }
            } finally {
                sql(c, "SET search_path TO public");
                sql(c, "DROP SCHEMA " + schema + " CASCADE");
            }
        }
    }
    private void sql(Connection c, String comando) throws SQLException { try (var s = c.createStatement()) { s.execute(comando); } }
}
