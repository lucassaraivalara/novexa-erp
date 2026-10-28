package br.com.novexa.erp.repository;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.sql.DriverManager;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Comparator;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named="novexa.test.entrada.jdbc-url",matches="jdbc:postgresql://(127\\.0\\.0\\.1|localhost):[0-9]+/.*")
class ControleEstoqueMigrationTest {
    @Test void backendV59ERecoveryBridgeAceitamSchemaV60SemDowngradeEPreservamIdempotencia() throws Exception {
        String url=System.getProperty("novexa.test.entrada.jdbc-url"), password=System.getProperty("novexa.test.entrada.jdbc-password","");
        String schema="recovery60_"+UUID.randomUUID().toString().replace("-","");
        Path source=Path.of("src/main/resources/db/migration"), bridge=Files.createTempDirectory("novexa-v59-recovery-");
        try {
            try(var migrations=Files.list(source)) {
                for(Path file:migrations.filter(p->p.getFileName().toString().matches("V\\d+__.*\\.sql") && !p.getFileName().toString().startsWith("V60__")).toList())
                    Files.copy(file,bridge.resolve(file.getFileName()),StandardCopyOption.REPLACE_EXISTING);
            }
            var v59=Flyway.configure().dataSource(url,"postgres",password).schemas(schema).defaultSchema(schema)
                    .locations("filesystem:"+bridge.toAbsolutePath()).target("59").load();
            v59.migrate();
            var v60=Flyway.configure().dataSource(url,"postgres",password).schemas(schema).defaultSchema(schema).load();
            assertThat(v60.migrate().migrationsExecuted).isEqualTo(1);
            try(var c=DriverManager.getConnection(url,"postgres",password);var s=c.createStatement()) {
                s.execute("set search_path to "+schema);
                s.execute("set session_replication_role=replica");
                s.execute("insert into ajustes_estoque_lote(empresa_id,usuario_id,chave_requisicao,resumo_requisicao,motivo,data_hora,resultado) values(1,1,'d54d51e8-ea13-4e24-b7c7-36b4abc5d23e','fixture-hash','recovery-test',current_timestamp,'{\"persistido\":true}')");
                s.execute("set session_replication_role=origin");
                var antigo=Flyway.configure().dataSource(url,"postgres",password).schemas(schema).defaultSchema(schema)
                        .locations("filesystem:"+bridge.toAbsolutePath()).load();
                antigo.validate();
                assertThat(antigo.migrate().migrationsExecuted).isZero();
                Files.copy(source.resolve("V60__ajustes_estoque_lote.sql"),bridge.resolve("V60__ajustes_estoque_lote.sql"),StandardCopyOption.REPLACE_EXISTING);
                var recovery=Flyway.configure().dataSource(url,"postgres",password).schemas(schema).defaultSchema(schema)
                        .locations("filesystem:"+bridge.toAbsolutePath()).load();
                recovery.validate();
                assertThat(recovery.migrate().migrationsExecuted).isZero();
                try(var rs=s.executeQuery("select resultado from ajustes_estoque_lote where chave_requisicao='d54d51e8-ea13-4e24-b7c7-36b4abc5d23e'")) {
                    assertThat(rs.next()).isTrue(); assertThat(rs.getString(1)).isEqualTo("{\"persistido\":true}");
                }
            } finally {
                try(var c=DriverManager.getConnection(url,"postgres",password);var s=c.createStatement()) { s.execute("drop schema if exists "+schema+" cascade"); }
            }
        } finally {
            try(var paths=Files.walk(bridge)) { for(Path p:paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(p); }
        }
    }

    @Test void v59ParaV60AdicionaIdempotenciaSemAlterarDadosExistentes() throws Exception {
        String url=System.getProperty("novexa.test.entrada.jdbc-url"), schema="stock60_"+UUID.randomUUID().toString().replace("-","");
        String password=System.getProperty("novexa.test.entrada.jdbc-password","");
        try(var c=DriverManager.getConnection(url,"postgres",password);var s=c.createStatement()) {
            try {
                Flyway f59=Flyway.configure().dataSource(url,"postgres",password).schemas(schema).defaultSchema(schema).target("59").load();
                f59.migrate();
                s.execute("set search_path to "+schema);
                s.execute("insert into empresas(id,razao_social) values(1,'Legado V59 sintético')");
                s.execute("insert into produtos(empresa_id,nome,unidade_medida,preco_custo,preco_venda,estoque_atual,data_cadastro) values(1,'Saldo preservado','UN',2,10,12.345,current_timestamp)");
                Flyway f60=Flyway.configure().dataSource(url,"postgres",password).schemas(schema).defaultSchema(schema).load();
                assertThat(f60.migrate().migrationsExecuted).isEqualTo(1);
                f60.validate();
                assertThat(f60.info().current().getVersion().getVersion()).isEqualTo("60");
                try(var rs=s.executeQuery("select estoque_atual from produtos where nome='Saldo preservado'")) {
                    assertThat(rs.next()).isTrue(); assertThat(rs.getBigDecimal(1)).isEqualByComparingTo("12.345");
                }
                try(var rs=s.executeQuery("select count(*) from ajustes_estoque_lote")) { rs.next(); assertThat(rs.getLong(1)).isZero(); }
                try(var rs=s.executeQuery("select count(*) from information_schema.table_constraints where table_schema='"+schema+"' and table_name='ajustes_estoque_lote' and constraint_name='uk_ajuste_lote_empresa_chave'")) { rs.next(); assertThat(rs.getLong(1)).isEqualTo(1); }
            } finally { s.execute("set search_path to public"); s.execute("drop schema if exists "+schema+" cascade"); }
        }
    }

    @Test void v58ParaV59PreservaSaldoControleIndividualEHistorico() throws Exception {
        String url=System.getProperty("novexa.test.entrada.jdbc-url"), schema="stock59_"+UUID.randomUUID().toString().replace("-","");
        String password=System.getProperty("novexa.test.entrada.jdbc-password","");
        try(var c=DriverManager.getConnection(url,"postgres",password);var s=c.createStatement()) {
            try {
                Flyway.configure().dataSource(url,"postgres",password).schemas(schema).defaultSchema(schema).target("58").load().migrate();
                s.execute("set search_path to "+schema);
                s.execute("insert into empresas(id,razao_social) values(1,'Legado sint?tico')");
                s.execute("insert into produtos(empresa_id,nome,unidade_medida,preco_custo,preco_venda,estoque_atual,controla_estoque,data_cadastro) values(1,'Com controle','UN',2,10,12.345,true,current_timestamp),(1,'Sem controle','UN',2,10,3.210,false,current_timestamp)");
                var f=Flyway.configure().dataSource(url,"postgres",password).schemas(schema).defaultSchema(schema).target("59").load();
                assertThat(f.migrate().migrationsExecuted).isEqualTo(1); f.validate();
                assertThat(f.info().current().getVersion().getVersion()).isEqualTo("59");
                assertThat(f.migrate().migrationsExecuted).isZero();
                try(var rs=s.executeQuery("select controla_estoque from empresas where id=1")) {assertThat(rs.next()).isTrue();assertThat(rs.getBoolean(1)).isTrue();}
                try(var rs=s.executeQuery("select estoque_atual,controla_estoque from produtos order by id")) {
                    assertThat(rs.next()).isTrue();assertThat(rs.getBigDecimal(1)).isEqualByComparingTo("12.345");assertThat(rs.getBoolean(2)).isTrue();
                    assertThat(rs.next()).isTrue();assertThat(rs.getBigDecimal(1)).isEqualByComparingTo("3.210");assertThat(rs.getBoolean(2)).isFalse();
                }
                try(var rs=s.executeQuery("select count(*) from movimentacoes_estoque")) {rs.next();assertThat(rs.getLong(1)).isZero();}
                try(var rs=s.executeQuery("select column_default,is_nullable from information_schema.columns where table_schema='"+schema+"' and table_name='itens_venda' and column_name='controle_estoque_aplicado'")) {
                    assertThat(rs.next()).isTrue();assertThat(rs.getString(1)).isNull();assertThat(rs.getString(2)).isEqualTo("YES");
                }
            } finally {s.execute("set search_path to public");s.execute("drop schema if exists "+schema+" cascade");}
        }
    }
}
