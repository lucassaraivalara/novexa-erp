package br.com.novexa.erp.repository;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import java.sql.DriverManager;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@EnabledIfSystemProperty(named = "novexa.test.cancelamento.jdbc-url", matches = "jdbc:postgresql:.*")
class CancelamentoVendaMigrationTest {
    @Test
    void migrationLiberaEstadosEHistoricoDoCancelamento() throws Exception {
        String url = System.getProperty("novexa.test.cancelamento.jdbc-url");
        String usuario = System.getProperty("novexa.test.cancelamento.jdbc-user", "postgres");
        String senha = System.getProperty("novexa.test.cancelamento.jdbc-password", "");
        String schema = "cancelamento_" + UUID.randomUUID().toString().replace("-", "");

        var anterior = flyway(url, usuario, senha, schema, "14");
        anterior.migrate();
        try {
            var atual = flyway(url, usuario, senha, schema, null);
            assertThat(atual.migrate().migrationsExecuted).isEqualTo(1);
            atual.validate();
            assertThat(atual.migrate().migrationsExecuted).isZero();

            try (var conexao = DriverManager.getConnection(url, usuario, senha)) {
                conexao.setSchema(schema);
                assertThat(definicao(conexao, "chk_pagamento_status")).contains("CANCELADO");
                assertThat(definicao(conexao, "chk_lancamento_situacao")).contains("CANCELADO");
                assertThat(definicao(conexao, "chk_mov_caixa_origem")).contains("ESTORNO_VENDA");
                assertThat(definicao(conexao, "uk_mov_caixa_pagamento_tipo"))
                        .contains("pagamento_id", "tipo");
            }
        } finally {
            try (var conexao = DriverManager.getConnection(url, usuario, senha);
                 var comando = conexao.createStatement()) {
                comando.execute("DROP SCHEMA " + schema + " CASCADE");
            }
        }
    }

    private static Flyway flyway(String url, String usuario, String senha, String schema, String alvo) {
        var configuracao = Flyway.configure().dataSource(url, usuario, senha)
                .schemas(schema).defaultSchema(schema).locations("classpath:db/migration");
        if (alvo != null) configuracao.target(alvo);
        return configuracao.load();
    }

    private static String definicao(java.sql.Connection conexao, String nome) throws Exception {
        try (var comando = conexao.prepareStatement(
                "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = ? AND connamespace = ?::regnamespace")) {
            comando.setString(1, nome);
            comando.setString(2, conexao.getSchema());
            try (var resultado = comando.executeQuery()) {
                assertThat(resultado.next()).isTrue();
                return resultado.getString(1);
            }
        }
    }
}
