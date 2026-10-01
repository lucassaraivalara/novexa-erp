package br.com.novexa.erp.repository;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.sql.*;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "novexa.test.recebivel.jdbc-url", matches = "jdbc:postgresql:.*")
class LiquidacaoRecebivelMigrationTest {
    @Test void v30PreservaLegadoSemBackfillEDemaisRegrasDeDestino() throws Exception {
        String url = System.getProperty("novexa.test.recebivel.jdbc-url");
        String user = System.getProperty("novexa.test.recebivel.jdbc-user", "postgres");
        String password = System.getProperty("novexa.test.recebivel.jdbc-password", "");
        String schema = "teste_v30_" + UUID.randomUUID().toString().replace("-", "");
        try (var c = DriverManager.getConnection(url, user, password)) {
            sql(c, "CREATE SCHEMA " + schema);
            try {
                sql(c, "SET search_path TO " + schema);
                Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema).target("29").load().migrate();
                sql(c, "INSERT INTO empresas(id,razao_social) VALUES (1,'A'),(2,'B')");
                sql(c, "INSERT INTO usuario(id,empresa_id) VALUES (1,1),(2,2)");
                sql(c, "INSERT INTO contas_financeiras(id,empresa_id,nome,tipo,saldo_inicial,saldo_atual,ativo,data_criacao,data_atualizacao) VALUES (1,1,'A','CARTEIRA_DIGITAL',100,100,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),(2,2,'B','CARTEIRA_DIGITAL',100,100,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
                sql(c, "INSERT INTO configuracoes_formas_pagamento_empresa(id,empresa_id,forma_pagamento_id,tipo,nome_exibicao,ativo,data_criacao,data_atualizacao) VALUES (1,1,3,'DEBITO','Legada',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
                sql(c, "ALTER SEQUENCE configuracoes_formas_pagamento_empresa_id_seq RESTART WITH 2");
                sql(c, "INSERT INTO vendas(id,empresa_id,usuario_id,data_hora,status) VALUES (1,1,1,CURRENT_TIMESTAMP,'FATURADA')");
                sql(c, "INSERT INTO pagamentos(id,empresa_id,venda_id,usuario_id,sequencia,chave_requisicao,forma_pagamento,forma_pagamento_id,valor,status,data_hora) VALUES (1,1,1,1,1,'" + UUID.randomUUID() + "','CARTAO_DEBITO',3,20,'REGISTRADO',CURRENT_TIMESTAMP)");
                sql(c, "INSERT INTO recebiveis(id,empresa_id,pagamento_id,venda_id,tipo,numero_parcela,total_parcelas,valor_bruto,valor_liquido_previsto,data_venda,status,criado_em) VALUES (1,1,1,1,'DEBITO',1,1,20,20,CURRENT_TIMESTAMP,'PENDENTE',CURRENT_TIMESTAMP)");
                var result = Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema).target("30").load().migrate();
                assertThat(result.migrationsExecuted).isEqualTo(1);
                try (var s = c.createStatement(); var r = s.executeQuery("SELECT status,data_liquidacao,valor_liquido_recebido FROM recebiveis")) {
                    assertThat(r.next()).isTrue(); assertThat(r.getString(1)).isEqualTo("PENDENTE");
                    assertThat(r.getObject(2)).isNull(); assertThat(r.getObject(3)).isNull(); assertThat(r.next()).isFalse();
                }
                try (var s = c.createStatement(); var r = s.executeQuery("SELECT conta_financeira_destino_id FROM configuracoes_formas_pagamento_empresa")) {
                    assertThat(r.next()).isTrue(); assertThat(r.getObject(1)).isNull();
                }
                sql(c, "UPDATE configuracoes_formas_pagamento_empresa SET conta_financeira_destino_id=1 WHERE id=1");
                sql(c, "INSERT INTO configuracoes_formas_pagamento_empresa(empresa_id,forma_pagamento_id,tipo,nome_exibicao,conta_financeira_destino_id,data_criacao,data_atualizacao) VALUES (1,4,'CREDITO','Credito',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
                assertThatThrownBy(() -> sql(c, "UPDATE configuracoes_formas_pagamento_empresa SET conta_financeira_destino_id=2 WHERE id=1"))
                        .isInstanceOf(SQLException.class);
                for (String par : new String[]{"1,'DINHEIRO'", "5,'BOLETO'"})
                    assertThatThrownBy(() -> sql(c, "INSERT INTO configuracoes_formas_pagamento_empresa(empresa_id,forma_pagamento_id,tipo,nome_exibicao,conta_financeira_destino_id,data_criacao,data_atualizacao) VALUES (1," + par + ",'Invalida',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
                            .isInstanceOf(SQLException.class);
                for (String par : new String[]{"2,'PIX'", "6,'TRANSFERENCIA'"})
                    assertThatThrownBy(() -> sql(c, "INSERT INTO configuracoes_formas_pagamento_empresa(empresa_id,forma_pagamento_id,tipo,nome_exibicao,data_criacao,data_atualizacao) VALUES (1," + par + ",'Invalida',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
                            .isInstanceOf(SQLException.class);
                try (var s = c.createStatement(); var r = s.executeQuery("SELECT count(*) FROM movimentacoes_financeiras")) {
                    assertThat(r.next()).isTrue(); assertThat(r.getLong(1)).isZero();
                }
            } finally { sql(c, "SET search_path TO public"); sql(c, "DROP SCHEMA " + schema + " CASCADE"); }
        }
    }
    private void sql(Connection c, String comando) throws SQLException { try (var s = c.createStatement()) { s.execute(comando); } }
}
