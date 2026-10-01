package br.com.novexa.erp.repository;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.sql.*;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "novexa.test.config-formas.jdbc-url", matches = "jdbc:postgresql:.*")
class ConfiguracaoFormaPagamentoEmpresaMigrationTest {
    @Test void v24EV25PreservamDadosEProtegemNomeTenantTipoEDestino() throws Exception {
        String url = System.getProperty("novexa.test.config-formas.jdbc-url");
        String user = System.getProperty("novexa.test.config-formas.jdbc-user", "postgres");
        String password = System.getProperty("novexa.test.config-formas.jdbc-password", "");
        String schema = "teste_config_forma_" + UUID.randomUUID().toString().replace("-", "");
        try (var c = DriverManager.getConnection(url, user, password)) {
            sql(c, "CREATE SCHEMA " + schema);
            try {
                sql(c, "SET search_path TO " + schema);
                Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema)
                        .target("23").load().migrate();
                sql(c, "INSERT INTO empresas(id,razao_social) VALUES (1,'Empresa A'),(2,'Empresa B')");
                sql(c, "INSERT INTO contas_financeiras(id,empresa_id,nome,tipo,saldo_inicial,saldo_atual,ativo,data_criacao,data_atualizacao) VALUES "
                        + "(1,1,'Banco A','BANCO',100,100,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),"
                        + "(2,2,'Carteira B','CARTEIRA_DIGITAL',200,200,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
                String catalogo = catalogo(c);
                var migration = Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema)
                        .target("24").load().migrate();
                assertThat(migration.migrationsExecuted).isEqualTo(1);
                assertThat(catalogo(c)).isEqualTo(catalogo);
                assertThat(contar(c, "configuracoes_formas_pagamento_empresa")).isZero();
                try (var s = c.createStatement(); var r = s.executeQuery("SELECT sum(saldo_atual) FROM contas_financeiras")) {
                    assertThat(r.next()).isTrue(); assertThat(r.getBigDecimal(1)).isEqualByComparingTo("300");
                }
                inserir(c, 1, 2, "PIX", "PIX Sicredi", 1L);
                var normalizacao = Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema)
                        .target("25").load().migrate();
                assertThat(normalizacao.migrationsExecuted).isEqualTo(1);
                try (var s = c.createStatement(); var r = s.executeQuery("SELECT nome_exibicao,nome_normalizado,conta_financeira_destino_id FROM configuracoes_formas_pagamento_empresa")) {
                    assertThat(r.next()).isTrue();
                    assertThat(r.getString(1)).isEqualTo("PIX Sicredi");
                    assertThat(r.getString(2)).isEqualTo("pix sicredi");
                    assertThat(r.getLong(3)).isEqualTo(1L);
                }
                assertThatThrownBy(() -> sql(c, "UPDATE configuracoes_formas_pagamento_empresa SET nome_normalizado='adulterado'"))
                        .isInstanceOf(SQLException.class);
                inserir(c, 1, 2, "PIX", "PIX Mercado Pago", 1L);
                inserir(c, 2, 2, "PIX", "PIX Sicredi", 2L);
                inserir(c, 1, 4, "CREDITO", "Credito Stone", null);
                inserir(c, 1, 4, "CREDITO", "Credito Cielo", null);
                assertThatThrownBy(() -> inserir(c, 1, 2, "PIX", " pix sicredi ", 1L)).isInstanceOf(SQLException.class);
                assertThatThrownBy(() -> inserir(c, 1, 2, "PIX", "Externa", 2L)).isInstanceOf(SQLException.class);
                assertThatThrownBy(() -> inserir(c, 999, 1, "DINHEIRO", "Empresa inexistente", null)).isInstanceOf(SQLException.class);
                assertThatThrownBy(() -> inserir(c, 1, 999, "DINHEIRO", "Forma inexistente", null)).isInstanceOf(SQLException.class);
                assertThatThrownBy(() -> inserir(c, 1, 2, "DINHEIRO", "Tipo adulterado", null)).isInstanceOf(SQLException.class);
                assertThatThrownBy(() -> inserir(c, 1, 1, "DINHEIRO", "   ", null)).isInstanceOf(SQLException.class);
                for (long forma : new long[]{2, 6}) {
                    String tipo = forma == 2 ? "PIX" : "TRANSFERENCIA";
                    assertThatThrownBy(() -> inserir(c, 1, forma, tipo, "Sem destino", null)).isInstanceOf(SQLException.class);
                }
                for (String tipo : new String[]{"DINHEIRO", "DEBITO", "CREDITO", "BOLETO"}) {
                    long forma = switch (tipo) { case "DINHEIRO" -> 1; case "DEBITO" -> 3; case "CREDITO" -> 4; default -> 5; };
                    inserir(c, 1, forma, tipo, tipo, null);
                    assertThatThrownBy(() -> inserir(c, 1, forma, tipo, tipo + " invalido", 1L)).isInstanceOf(SQLException.class);
                }
                inserir(c, 1, 6, "TRANSFERENCIA", "Transferencia", 1L);
                assertThatThrownBy(() -> sql(c, "UPDATE configuracoes_formas_pagamento_empresa SET conta_financeira_destino_id=2 WHERE nome_exibicao='PIX Sicredi' AND empresa_id=1"))
                        .isInstanceOf(SQLException.class);
                sql(c, "UPDATE contas_financeiras SET ativo=FALSE WHERE id=1");
                sql(c, "UPDATE configuracoes_formas_pagamento_empresa SET nome_exibicao='PIX renomeado',ativo=FALSE WHERE empresa_id=1 AND nome_exibicao='PIX Sicredi'");
                try (var s = c.createStatement(); var r = s.executeQuery("SELECT nome_normalizado FROM configuracoes_formas_pagamento_empresa WHERE nome_exibicao='PIX renomeado'")) {
                    assertThat(r.next()).isTrue(); assertThat(r.getString(1)).isEqualTo("pix renomeado");
                }
                assertThat(contar(c, "configuracoes_formas_pagamento_empresa")).isEqualTo(10);
                assertThat(contar(c, "movimentacoes_financeiras")).isZero();
            } finally {
                sql(c, "SET search_path TO public");
                sql(c, "DROP SCHEMA " + schema + " CASCADE");
            }
        }
    }
    private void inserir(Connection c, long empresa, long forma, String tipo, String nome, Long destino) throws SQLException {
        try (var s = c.prepareStatement("INSERT INTO configuracoes_formas_pagamento_empresa(empresa_id,forma_pagamento_id,tipo,nome_exibicao,conta_financeira_destino_id,data_criacao,data_atualizacao) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")) {
            s.setLong(1, empresa); s.setLong(2, forma); s.setString(3, tipo); s.setString(4, nome); s.setObject(5, destino);
            s.executeUpdate();
        }
    }
    private String catalogo(Connection c) throws SQLException {
        try (var s = c.createStatement(); var r = s.executeQuery("SELECT string_agg(id || ':' || descricao || ':' || tipo || ':' || ativo, ',' ORDER BY id) FROM formas_pagamento")) {
            r.next(); return r.getString(1);
        }
    }
    private long contar(Connection c, String tabela) throws SQLException {
        try (var s = c.createStatement(); var r = s.executeQuery("SELECT count(*) FROM " + tabela)) { r.next(); return r.getLong(1); }
    }
    private void sql(Connection c, String comando) throws SQLException { try (var s = c.createStatement()) { s.execute(comando); } }
}
