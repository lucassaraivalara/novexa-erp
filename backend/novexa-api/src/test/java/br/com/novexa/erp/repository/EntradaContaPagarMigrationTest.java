package br.com.novexa.erp.repository;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.sql.DriverManager;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

@EnabledIfSystemProperty(named = "novexa.test.entrada.jdbc-url", matches = "jdbc:postgresql:.*")
class EntradaContaPagarMigrationTest {
    @Test void upgradeV36PreservaEntradaContaESaldoSemCriarObrigacao() throws Exception {
        String schema = "teste_v37_" + UUID.randomUUID().toString().replace("-", "");
        String url = System.getProperty("novexa.test.entrada.jdbc-url"), user = System.getProperty("novexa.test.entrada.jdbc-user", "postgres");
        String password = System.getenv().getOrDefault("NOVEXA_ENTRADA_TEST_DB_PASSWORD", "");
        try (var c = DriverManager.getConnection(url, user, password); var s = c.createStatement()) {
            try {
                Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema).target("36").load().migrate();
                s.execute("SET search_path TO " + schema);
                s.execute("INSERT INTO empresas(id,razao_social) VALUES(1,'Legado')");
                s.execute("INSERT INTO usuario(id,empresa_id,nome_usuario,cpf,senha,perfil) VALUES(1,1,'Legado','02360684663','teste','GERENTE')");
                s.execute("INSERT INTO fornecedores(id,empresa_id,razao_social,data_cadastro) VALUES(1,1,'Fornecedor legado',CURRENT_TIMESTAMP)");
                s.execute("INSERT INTO produtos(empresa_id,nome,unidade_medida,preco_custo,preco_venda,estoque_atual,data_cadastro) VALUES(1,'Legado','UN',2,10,100,CURRENT_TIMESTAMP)");
                s.execute("INSERT INTO contas_pagar(empresa_id,descricao,data_vencimento,valor,status) VALUES(1,'Obrigação anterior',CURRENT_DATE,50,'ABERTA')");
                s.execute("INSERT INTO entradas_mercadoria(empresa_id,fornecedor_id,origem,status,data_entrada,valor_produtos,valor_total,data_cadastro,data_atualizacao,usuario_cadastro_id) VALUES(1,1,'MANUAL','RASCUNHO',CURRENT_DATE,0,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,1)");
                var flyway = Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema).load();
                var resultado = flyway.migrate();
                assertThat(resultado.migrationsExecuted).isEqualTo(1); assertThat(resultado.targetSchemaVersion).isEqualTo("37");
                flyway.validate(); assertThat(flyway.migrate().migrationsExecuted).isZero();
                try (var r = s.executeQuery("select conta_pagar_id,origem_conta_pagar from entradas_mercadoria")) {
                    assertThat(r.next()).isTrue(); assertThat(r.getObject(1)).isNull(); assertThat(r.getObject(2)).isNull();
                }
                try (var r = s.executeQuery("select count(*),sum(valor) from contas_pagar")) {
                    r.next(); assertThat(r.getInt(1)).isEqualTo(1); assertThat(r.getBigDecimal(2)).isEqualByComparingTo("50");
                }
                try (var r = s.executeQuery("select estoque_atual,preco_custo from produtos")) {
                    r.next(); assertThat(r.getBigDecimal(1)).isEqualByComparingTo("100"); assertThat(r.getBigDecimal(2)).isEqualByComparingTo("2");
                }
                try (var r = s.executeQuery("select count(*) from movimentacoes_financeiras")) { r.next(); assertThat(r.getInt(1)).isZero(); }
            } finally { s.execute("SET search_path TO public"); s.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE"); }
        }
    }
}
