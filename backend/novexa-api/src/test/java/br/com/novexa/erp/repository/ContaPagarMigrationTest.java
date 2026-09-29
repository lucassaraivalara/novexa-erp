package br.com.novexa.erp.repository;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import java.sql.*;
import static org.assertj.core.api.Assertions.*;

class ContaPagarMigrationTest {
    @Test void schemaProtegeFornecedorTenantEEstadoDePagamento() throws Exception {
        try (var conexao = DriverManager.getConnection("jdbc:h2:mem:conta-pagar-migration;MODE=PostgreSQL", "sa", "")) {
            executar(conexao, "CREATE TABLE empresas (id BIGINT PRIMARY KEY)");
            executar(conexao, "CREATE TABLE fornecedores (id BIGINT PRIMARY KEY, empresa_id BIGINT NOT NULL)");
            ScriptUtils.executeSqlScript(conexao, new ClassPathResource("db/migration/V17__cria_contas_pagar.sql"));
            executar(conexao, "INSERT INTO empresas VALUES (1), (2)");
            executar(conexao, "INSERT INTO fornecedores VALUES (10, 1), (20, 2)");
            executar(conexao, "INSERT INTO contas_pagar (empresa_id,fornecedor_id,descricao,data_vencimento,valor) VALUES (1,10,'Aluguel','2026-10-10',200)");
            assertThatThrownBy(() -> executar(conexao,
                    "INSERT INTO contas_pagar (empresa_id,fornecedor_id,descricao,data_vencimento,valor) VALUES (1,20,'Outro','2026-10-10',200)"))
                    .isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> executar(conexao,
                    "UPDATE contas_pagar SET status='PAGA' WHERE id=1"))
                    .isInstanceOf(SQLException.class);
            executar(conexao, "UPDATE contas_pagar SET status='PAGA',data_pagamento='2026-10-01',valor_pago=200 WHERE id=1");
            assertThatThrownBy(() -> executar(conexao,
                    "UPDATE contas_pagar SET status='ABERTA' WHERE id=1"))
                    .isInstanceOf(SQLException.class);
        }
    }

    private void executar(Connection conexao, String sql) throws SQLException {
        try (var comando = conexao.createStatement()) { comando.execute(sql); }
    }
}
