package br.com.novexa.erp.controller;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.sql.DriverManager;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "novexa.test.usuarios.jdbc-url", matches = "jdbc:postgresql:.*")
class UsuariosMigrationPostgresTest {
    @ParameterizedTest @ValueSource(booleans = {false, true})
    void evoluiV42PreservandoAdminOuRecusaEmailLegadoDuplicadoSemAlteracaoParcial(boolean duplicado) throws Exception {
        String url = System.getProperty("novexa.test.usuarios.jdbc-url");
        String user = System.getProperty("novexa.test.usuarios.jdbc-user", "novexa_test");
        String schema = "teste_usuario_migracao_" + UUID.randomUUID().toString().replace("-", "");
        try (var c = DriverManager.getConnection(url, user, ""); var s = c.createStatement()) {
            Flyway.configure().dataSource(url,user,"").schemas(schema).defaultSchema(schema).target("42").load().migrate();
            s.execute("set search_path to " + schema);
            // Somente fixtures no schema aleatório descartável, nunca usuários de produção.
            s.execute("insert into empresas(id,razao_social,cnpj,ativo) values (1,'Fixture','11222333000181',true)");
            String hash = new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder().encode("fixture");
            try (var p = c.prepareStatement("insert into usuario(id,nome_usuario,cpf,email,senha,ativo,perfil,empresa_id) values (1,'Admin','023.606.846-63','admin@fixture.com',?,true,'ADMIN',1)")) {
                p.setString(1,hash); p.executeUpdate();
            }
            if (duplicado) s.execute("insert into usuario(id,nome_usuario,cpf,email,ativo,perfil,empresa_id) values (2,'Outro','52998224725',' ADMIN@fixture.com ',true,'OPERADOR',1)");
            var flyway = Flyway.configure().dataSource(url,user,"").schemas(schema).defaultSchema(schema).load();
            if (duplicado) {
                assertThatThrownBy(flyway::migrate).isInstanceOf(FlywayException.class);
                try (var r = s.executeQuery("select count(*) from information_schema.columns where table_schema='"+schema+"' and table_name='usuario' and column_name='login'")) {
                    r.next(); assertThat(r.getInt(1)).isZero();
                }
            } else {
                flyway.migrate(); flyway.validate(); assertThat(flyway.migrate().migrationsExecuted).isZero();
                try (var r = s.executeQuery("select login,versao_token from usuario where id=1")) {
                    r.next(); assertThat(r.getString(1)).isEqualTo("02360684663"); assertThat(r.getLong(2)).isZero();
                }
            }
            try (var r = s.executeQuery("select cpf,senha,ativo,perfil,empresa_id from usuario where id=1")) {
                r.next(); assertThat(r.getString(1)).isEqualTo("023.606.846-63"); assertThat(r.getString(2)).isEqualTo(hash);
                assertThat(r.getBoolean(3)).isTrue(); assertThat(r.getString(4)).isEqualTo("ADMIN"); assertThat(r.getLong(5)).isEqualTo(1);
            }
        } finally {
            try (var c = DriverManager.getConnection(url,user,""); var s = c.createStatement()) { s.execute("drop schema if exists "+schema+" cascade"); }
        }
    }
}
