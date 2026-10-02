package br.com.novexa.erp.repository;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "novexa.test.fornecedor.jdbc-url", matches = "jdbc:postgresql:.*")
class FornecedorMigrationTest {
    private static final String URL = System.getProperty("novexa.test.fornecedor.jdbc-url");
    private static final String USER = System.getProperty("novexa.test.fornecedor.jdbc-user", "postgres");
    private static final String PASSWORD = System.getProperty("novexa.test.fornecedor.jdbc-password", "");

    @Test void upgradeV32PreservaLegadoENulosEUnicidadeNormalizadaPorTenant() throws Exception {
        String schema = "teste_v33_" + UUID.randomUUID().toString().replace("-", "");
        try (var c = DriverManager.getConnection(URL, USER, PASSWORD); var s = c.createStatement()) {
            try {
                Flyway.configure().dataSource(URL, USER, PASSWORD).schemas(schema).defaultSchema(schema).target("32").load().migrate();
                s.execute("SET search_path TO " + schema);
                s.execute("INSERT INTO empresas(id,razao_social) VALUES (1,'A'),(2,'B')");
                s.execute("INSERT INTO fornecedores(empresa_id,razao_social,cpf_cnpj,ativo,data_cadastro,endereco) "
                        + "VALUES (1,'Historico','529.982.247-25',false,'2025-01-01','Endereco preservado')");
                var resultado = Flyway.configure().dataSource(URL, USER, PASSWORD).schemas(schema).defaultSchema(schema).target("33").load().migrate();
                assertThat(resultado.migrationsExecuted).isEqualTo(1);
                assertThat(resultado.targetSchemaVersion).isEqualTo("33");
                try (var r = s.executeQuery("SELECT cpf_cnpj,ativo,data_cadastro,endereco,tipo_pessoa,data_atualizacao,cep FROM fornecedores")) {
                    assertThat(r.next()).isTrue(); assertThat(r.getString(1)).isEqualTo("529.982.247-25");
                    assertThat(r.getBoolean(2)).isFalse(); assertThat(r.getTimestamp(3).toLocalDateTime()).hasYear(2025);
                    assertThat(r.getString(4)).isEqualTo("Endereco preservado");
                    for (int i = 5; i <= 7; i++) assertThat(r.getObject(i)).isNull();
                }
                assertThatThrownBy(() -> s.execute("INSERT INTO fornecedores(empresa_id,razao_social,cpf_cnpj,data_cadastro) "
                        + "VALUES (1,'Duplicado','52998224725',CURRENT_TIMESTAMP)"))
                        .isInstanceOf(SQLException.class).hasMessageContaining("uk_fornecedor_empresa_documento_normalizado");
                s.execute("INSERT INTO fornecedores(empresa_id,razao_social,cpf_cnpj,data_cadastro) "
                        + "VALUES (2,'Outro tenant','52998224725',CURRENT_TIMESTAMP),(1,'Sem documento A',null,CURRENT_TIMESTAMP),"
                        + "(1,'Sem documento B',null,CURRENT_TIMESTAMP),(1,'Documento vazio A','',CURRENT_TIMESTAMP),"
                        + "(1,'Documento vazio B','',CURRENT_TIMESTAMP)");
                assertThatThrownBy(() -> s.execute("UPDATE fornecedores SET empresa_id=999 WHERE razao_social='Historico'"))
                        .isInstanceOf(SQLException.class).hasMessageContaining("fk_fornecedor_empresa");
                assertThatThrownBy(() -> s.execute("UPDATE fornecedores SET tipo_pessoa='INVALIDO' WHERE razao_social='Historico'"))
                        .isInstanceOf(SQLException.class).hasMessageContaining("ck_fornecedor_tipo_pessoa");
                try (var r = s.executeQuery("SELECT count(*) FROM fornecedores")) {
                    assertThat(r.next()).isTrue(); assertThat(r.getInt(1)).isEqualTo(6);
                }
                try (var r = s.executeQuery("SELECT count(*) FROM pg_constraint WHERE conname='uk_fornecedor_id_empresa' "
                        + "AND conrelid='fornecedores'::regclass")) {
                    assertThat(r.next()).isTrue(); assertThat(r.getInt(1)).isEqualTo(1);
                }
            } finally {
                s.execute("SET search_path TO public"); s.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
            }
        }
    }

    @Test void duplicidadeLegadaBloqueiaMigrationSemApagarOuReinterpretarDados() throws Exception {
        String schema = "teste_v33_duplicado_" + UUID.randomUUID().toString().replace("-", "");
        try (var c = DriverManager.getConnection(URL, USER, PASSWORD); var s = c.createStatement()) {
            try {
                Flyway.configure().dataSource(URL, USER, PASSWORD).schemas(schema).defaultSchema(schema).target("32").load().migrate();
                s.execute("SET search_path TO " + schema);
                s.execute("INSERT INTO empresas(id,razao_social) VALUES (1,'A')");
                s.execute("INSERT INTO fornecedores(empresa_id,razao_social,cpf_cnpj,data_cadastro) "
                        + "VALUES (1,'A','529.982.247-25',CURRENT_TIMESTAMP),(1,'B','52998224725',CURRENT_TIMESTAMP)");
                assertThatThrownBy(() -> Flyway.configure().dataSource(URL, USER, PASSWORD).schemas(schema).defaultSchema(schema)
                        .target("33").load().migrate()).hasMessageContaining("V33__completa_dominio_fornecedor.sql");
                try (var r = s.executeQuery("SELECT count(*),count(DISTINCT cpf_cnpj) FROM fornecedores")) {
                    assertThat(r.next()).isTrue(); assertThat(r.getInt(1)).isEqualTo(2); assertThat(r.getInt(2)).isEqualTo(2);
                }
            } finally {
                s.execute("SET search_path TO public"); s.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
            }
        }
    }
}
