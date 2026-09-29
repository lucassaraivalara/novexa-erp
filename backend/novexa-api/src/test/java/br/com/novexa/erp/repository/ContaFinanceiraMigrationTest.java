package br.com.novexa.erp.repository;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import java.sql.*;
import static org.assertj.core.api.Assertions.*;

class ContaFinanceiraMigrationTest {
    @Test void schemaProtegeSaldoVinculosETrailDeEstorno() throws Exception {
        try (var conexao = DriverManager.getConnection("jdbc:h2:mem:conta-financeira-migration;MODE=PostgreSQL", "sa", "")) {
            executar(conexao, "CREATE TABLE empresas (id BIGINT PRIMARY KEY)");
            executar(conexao, "CREATE TABLE usuario (id BIGINT PRIMARY KEY, empresa_id BIGINT, CONSTRAINT uk_usuario_id_empresa UNIQUE (id, empresa_id))");
            ScriptUtils.executeSqlScript(conexao, new ClassPathResource("db/migration/V19__cria_contas_e_movimentacoes_financeiras.sql"));
            executar(conexao, "INSERT INTO empresas VALUES (1), (2)");
            executar(conexao, "INSERT INTO usuario VALUES (10,1), (20,2)");
            executar(conexao, "INSERT INTO contas_financeiras (empresa_id,nome,tipo,saldo_inicial,saldo_atual,ativo,data_criacao,data_atualizacao) VALUES (1,'Conta','BANCO',100,100,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
            assertThatThrownBy(() -> executar(conexao, "UPDATE contas_financeiras SET saldo_atual=-1 WHERE id=1"))
                    .isInstanceOf(SQLException.class);
            executar(conexao, "INSERT INTO movimentacoes_financeiras (empresa_id,conta_financeira_id,tipo,origem,descricao,valor,data_movimento,usuario_id,data_criacao) VALUES (1,1,'ENTRADA','MANUAL','Entrada',10,'2026-09-29',10,CURRENT_TIMESTAMP)");
            assertThatThrownBy(() -> executar(conexao, "INSERT INTO movimentacoes_financeiras (empresa_id,conta_financeira_id,tipo,origem,descricao,valor,data_movimento,usuario_id,data_criacao) VALUES (2,1,'ENTRADA','MANUAL','Invasao',10,'2026-09-29',20,CURRENT_TIMESTAMP)"))
                    .isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> executar(conexao, "INSERT INTO movimentacoes_financeiras (empresa_id,conta_financeira_id,tipo,origem,descricao,valor,data_movimento,usuario_id,data_criacao) VALUES (1,1,'ENTRADA','MANUAL','Outro operador',10,'2026-09-29',20,CURRENT_TIMESTAMP)"))
                    .isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> executar(conexao, "UPDATE movimentacoes_financeiras SET estornada=TRUE WHERE id=1"))
                    .isInstanceOf(SQLException.class);
        }
    }

    private void executar(Connection conexao, String sql) throws SQLException {
        try (var comando = conexao.createStatement()) { comando.execute(sql); }
    }
}
