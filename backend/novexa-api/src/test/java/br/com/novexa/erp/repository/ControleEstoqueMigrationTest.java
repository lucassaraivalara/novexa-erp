package br.com.novexa.erp.repository;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.sql.DriverManager;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named="novexa.test.entrada.jdbc-url",matches="jdbc:postgresql://(127\\.0\\.0\\.1|localhost):[0-9]+/.*")
class ControleEstoqueMigrationTest {
    @Test void v58ParaV59PreservaSaldoControleIndividualEHistorico() throws Exception {
        String url=System.getProperty("novexa.test.entrada.jdbc-url"), schema="stock59_"+UUID.randomUUID().toString().replace("-","");
        String password=System.getProperty("novexa.test.entrada.jdbc-password","");
        try(var c=DriverManager.getConnection(url,"postgres",password);var s=c.createStatement()) {
            try {
                Flyway.configure().dataSource(url,"postgres",password).schemas(schema).defaultSchema(schema).target("58").load().migrate();
                s.execute("set search_path to "+schema);
                s.execute("insert into empresas(id,razao_social) values(1,'Legado sint?tico')");
                s.execute("insert into produtos(empresa_id,nome,unidade_medida,preco_custo,preco_venda,estoque_atual,controla_estoque,data_cadastro) values(1,'Com controle','UN',2,10,12.345,true,current_timestamp),(1,'Sem controle','UN',2,10,3.210,false,current_timestamp)");
                var f=Flyway.configure().dataSource(url,"postgres",password).schemas(schema).defaultSchema(schema).load();
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
