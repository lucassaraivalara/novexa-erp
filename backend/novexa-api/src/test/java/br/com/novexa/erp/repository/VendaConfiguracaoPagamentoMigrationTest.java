package br.com.novexa.erp.repository;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.sql.*;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "novexa.test.venda-config.jdbc-url", matches = "jdbc:postgresql:.*")
class VendaConfiguracaoPagamentoMigrationTest {
    @Test void v26PreservaLegadoEImpedeVinculosEntreEmpresas() throws Exception {
        String url = System.getProperty("novexa.test.venda-config.jdbc-url");
        String user = System.getProperty("novexa.test.venda-config.jdbc-user", "postgres");
        String password = System.getProperty("novexa.test.venda-config.jdbc-password", "");
        String schema = "teste_venda_config_" + UUID.randomUUID().toString().replace("-", "");
        try (var c = DriverManager.getConnection(url, user, password)) {
            sql(c, "CREATE SCHEMA " + schema);
            try {
                sql(c, "SET search_path TO " + schema);
                Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema).target("25").load().migrate();
                sql(c, "INSERT INTO empresas(id,razao_social) VALUES (1,'A'),(2,'B')");
                sql(c, "INSERT INTO usuario(id,empresa_id) VALUES (1,1),(2,2)");
                sql(c, "INSERT INTO configuracoes_formas_pagamento_empresa(id,empresa_id,forma_pagamento_id,tipo,nome_exibicao,data_criacao,data_atualizacao) VALUES "
                        + "(1,1,1,'DINHEIRO','Dinheiro A',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),"
                        + "(2,2,1,'DINHEIRO','Dinheiro B',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
                String chave = UUID.randomUUID().toString();
                sql(c, "INSERT INTO vendas(id,empresa_id,usuario_id,chave_requisicao,resumo_requisicao,data_hora,status,subtotal,desconto,total,forma_pagamento,valor_recebido,troco) VALUES "
                        + "(1,1,1,'" + chave + "','legado',CURRENT_TIMESTAMP,'FATURADA',10,0,10,'DINHEIRO',10,0)");
                sql(c, "INSERT INTO pagamentos(id,empresa_id,venda_id,usuario_id,sequencia,chave_requisicao,forma_pagamento,forma_pagamento_id,valor,status,data_hora,valor_recebido,troco) VALUES "
                        + "(1,1,1,1,1,'" + chave + "','DINHEIRO',1,10,'REGISTRADO',CURRENT_TIMESTAMP,10,0)");
                var result = Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema).target("26").load().migrate();
                assertThat(result.migrationsExecuted).isEqualTo(1);
                for (String tabela : new String[]{"vendas", "pagamentos"}) {
                    try (var s = c.createStatement(); var r = s.executeQuery("SELECT configuracao_forma_pagamento_id,chave_requisicao,forma_pagamento FROM " + tabela + " WHERE id=1")) {
                        assertThat(r.next()).isTrue(); assertThat(r.getObject(1)).isNull();
                        assertThat(r.getString(2)).isEqualTo(chave); assertThat(r.getString(3)).isEqualTo("DINHEIRO");
                    }
                    for (long invalido : new long[]{2, 999})
                        assertThatThrownBy(() -> sql(c, "UPDATE " + tabela + " SET configuracao_forma_pagamento_id=" + invalido + " WHERE id=1"))
                                .isInstanceOf(SQLException.class);
                    sql(c, "UPDATE " + tabela + " SET configuracao_forma_pagamento_id=1 WHERE id=1");
                }
                sql(c, "UPDATE configuracoes_formas_pagamento_empresa SET ativo=FALSE WHERE id=1");
                assertThatThrownBy(() -> sql(c, "DELETE FROM configuracoes_formas_pagamento_empresa WHERE id=1"))
                        .isInstanceOf(SQLException.class);
                try (var s = c.createStatement(); var r = s.executeQuery("SELECT v.total,p.valor,v.configuracao_forma_pagamento_id,p.configuracao_forma_pagamento_id FROM vendas v JOIN pagamentos p ON p.venda_id=v.id")) {
                    assertThat(r.next()).isTrue(); assertThat(r.getBigDecimal(1)).isEqualByComparingTo("10");
                    assertThat(r.getBigDecimal(2)).isEqualByComparingTo("10");
                    assertThat(r.getLong(3)).isEqualTo(1); assertThat(r.getLong(4)).isEqualTo(1);
                    assertThat(r.next()).isFalse();
                }
            } finally {
                sql(c, "SET search_path TO public");
                sql(c, "DROP SCHEMA " + schema + " CASCADE");
            }
        }
    }
    private void sql(Connection c, String comando) throws SQLException { try (var s = c.createStatement()) { s.execute(comando); } }
}
