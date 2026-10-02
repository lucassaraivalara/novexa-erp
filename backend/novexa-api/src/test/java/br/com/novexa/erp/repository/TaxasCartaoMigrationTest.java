package br.com.novexa.erp.repository;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.sql.*;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "novexa.test.recebivel.jdbc-url", matches = "jdbc:postgresql:.*")
class TaxasCartaoMigrationTest {
    @Test void upgradeV30PreservaValoresHistoricosSemInventarCondicoes() throws Exception {
        String url = System.getProperty("novexa.test.recebivel.jdbc-url");
        String user = System.getProperty("novexa.test.recebivel.jdbc-user", "postgres");
        String password = System.getProperty("novexa.test.recebivel.jdbc-password", "");
        String schema = "teste_v31_" + UUID.randomUUID().toString().replace("-", "");
        try (var c = DriverManager.getConnection(url, user, password); var s = c.createStatement()) {
            s.execute("CREATE SCHEMA " + schema);
            try {
                s.execute("SET search_path TO " + schema);
                Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema).target("30").load().migrate();
                s.execute("INSERT INTO empresas(id,razao_social) VALUES (1,'Teste')");
                s.execute("INSERT INTO usuario(id,empresa_id) VALUES (1,1)");
                s.execute("INSERT INTO configuracoes_formas_pagamento_empresa(id,empresa_id,forma_pagamento_id,tipo,nome_exibicao,data_criacao,data_atualizacao) VALUES (1,1,3,'DEBITO','Legada',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
                s.execute("INSERT INTO vendas(id,empresa_id,usuario_id,data_hora,status) VALUES (1,1,1,CURRENT_TIMESTAMP,'FATURADA')");
                s.execute("INSERT INTO pagamentos(id,empresa_id,venda_id,usuario_id,sequencia,chave_requisicao,forma_pagamento,forma_pagamento_id,valor,status,data_hora) VALUES (1,1,1,1,1,'" + UUID.randomUUID() + "','CARTAO_DEBITO',3,20,'REGISTRADO',CURRENT_TIMESTAMP)");
                s.execute("INSERT INTO recebiveis(id,empresa_id,pagamento_id,venda_id,tipo,numero_parcela,total_parcelas,valor_bruto,valor_liquido_previsto,data_venda,status,criado_em) VALUES (1,1,1,1,'DEBITO',1,1,20,18.50,CURRENT_TIMESTAMP,'PENDENTE',CURRENT_TIMESTAMP)");
                var resultado = Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema).target("31").load().migrate();
                assertThat(resultado.migrationsExecuted).isEqualTo(1);
                assertThat(resultado.targetSchemaVersion).isEqualTo("31");
                try (var r = s.executeQuery("SELECT valor_bruto,valor_liquido_previsto,data_prevista_recebimento,taxa_percentual_snapshot,taxa_fixa_snapshot,valor_taxas_previsto,prazo_recebimento_dias_snapshot,status FROM recebiveis")) {
                    assertThat(r.next()).isTrue();
                    assertThat(r.getBigDecimal(1)).isEqualByComparingTo("20");
                    assertThat(r.getBigDecimal(2)).isEqualByComparingTo("18.50");
                    for (int i = 3; i <= 7; i++) assertThat(r.getObject(i)).isNull();
                    assertThat(r.getString(8)).isEqualTo("PENDENTE"); assertThat(r.next()).isFalse();
                }
                for (String tabela : new String[]{"pagamentos", "configuracoes_formas_pagamento_empresa"}) {
                    String sufixo = tabela.equals("pagamentos") ? "_snapshot" : "";
                    try (var r = s.executeQuery("SELECT taxa_percentual" + sufixo + ",taxa_fixa" + sufixo + ",prazo_recebimento_dias" + sufixo + " FROM " + tabela)) {
                        assertThat(r.next()).isTrue(); for (int i = 1; i <= 3; i++) assertThat(r.getObject(i)).isNull();
                    }
                }
                for (String atualizacao : new String[]{"taxa_percentual=-1", "taxa_percentual=100.01", "taxa_fixa=-0.01", "prazo_recebimento_dias=-1"})
                    assertThatThrownBy(() -> s.execute("UPDATE configuracoes_formas_pagamento_empresa SET " + atualizacao))
                            .isInstanceOf(SQLException.class);
                assertThatThrownBy(() -> s.execute("UPDATE pagamentos SET taxa_percentual_snapshot=3"))
                        .isInstanceOf(SQLException.class);
                assertThatThrownBy(() -> s.execute("UPDATE recebiveis SET taxa_percentual_snapshot=3,taxa_fixa_snapshot=0,valor_taxas_previsto=1,prazo_recebimento_dias_snapshot=30,data_prevista_recebimento=CURRENT_DATE"))
                        .isInstanceOf(SQLException.class);
                try (var r = s.executeQuery("SELECT count(*) FROM movimentacoes_financeiras")) {
                    assertThat(r.next()).isTrue(); assertThat(r.getLong(1)).isZero();
                }
            } finally { s.execute("SET search_path TO public"); s.execute("DROP SCHEMA " + schema + " CASCADE"); }
        }
    }
}
