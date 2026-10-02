package br.com.novexa.erp.repository;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.sql.DriverManager;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

@EnabledIfSystemProperty(named = "novexa.test.entrada.jdbc-url", matches = "jdbc:postgresql:.*")
class EntradaMercadoriaMigrationTest {
    @Test void upgradeV33PreservaProdutosFornecedoresEEstoque() throws Exception {
        String schema = "teste_v34_"+UUID.randomUUID().toString().replace("-","");
        String url = System.getProperty("novexa.test.entrada.jdbc-url"), user = System.getProperty("novexa.test.entrada.jdbc-user","postgres"),
                password = System.getProperty("novexa.test.entrada.jdbc-password","");
        try (var c = DriverManager.getConnection(url,user,password); var s = c.createStatement()) {
            try {
                Flyway.configure().dataSource(url,user,password).schemas(schema).defaultSchema(schema).target("33").load().migrate();
                s.execute("SET search_path TO "+schema);
                s.execute("INSERT INTO empresas(id,razao_social) VALUES(1,'Legado')");
                s.execute("INSERT INTO fornecedores(empresa_id,razao_social,data_cadastro) VALUES(1,'Fornecedor legado',CURRENT_TIMESTAMP)");
                s.execute("INSERT INTO produtos(empresa_id,nome,unidade_medida,preco_custo,preco_venda,estoque_atual,data_cadastro) VALUES(1,'Produto legado','UN',2,10,100,CURRENT_TIMESTAMP)");
                var r = Flyway.configure().dataSource(url,user,password).schemas(schema).defaultSchema(schema).load().migrate();
                assertThat(r.migrationsExecuted).isEqualTo(1); assertThat(r.targetSchemaVersion).isEqualTo("34");
                try (var dados = s.executeQuery("select estoque_atual,preco_custo from produtos")) {
                    assertThat(dados.next()).isTrue(); assertThat(dados.getBigDecimal(1)).isEqualByComparingTo("100"); assertThat(dados.getBigDecimal(2)).isEqualByComparingTo("2");
                }
                try (var dados = s.executeQuery("select count(*) from entradas_mercadoria")) { dados.next(); assertThat(dados.getInt(1)).isZero(); }
            } finally { s.execute("SET search_path TO public"); s.execute("DROP SCHEMA IF EXISTS "+schema+" CASCADE"); }
        }
    }
}
