package br.com.novexa.erp.controller;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.test.context.*;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.beans.factory.annotation.Autowired;
import org.flywaydb.core.Flyway;
import java.util.UUID;
import java.sql.DriverManager;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named="novexa.test.kit.jdbc-url",matches="jdbc:postgresql:.*")
@Sql(statements={"delete from formas_pagamento", "insert into formas_pagamento(id,descricao,tipo,ativo) values (1,'Dinheiro','DINHEIRO',true),(2,'PIX','PIX',true),(3,'Debito','DEBITO',true),(4,'Credito','CREDITO',true),(5,'Boleto','BOLETO',true),(6,'Transferencia','TRANSFERENCIA',true)","alter sequence formas_pagamento_id_seq restart with 7"})
class KitProdutoPostgresTest extends KitProdutoHttpTest {
    static final String SCHEMA="kit_"+UUID.randomUUID().toString().replace("-","");
    static final String URL=System.getProperty("novexa.test.kit.jdbc-url");
    @Autowired Flyway flyway;
    @DynamicPropertySource static void properties(DynamicPropertyRegistry p) {
        if(!URL.matches("jdbc:postgresql://(127\\.0\\.0\\.1|localhost):[0-9]+/.*"))throw new IllegalStateException("Somente PostgreSQL descartável local.");
        p.add("spring.datasource.url",()->URL+"?currentSchema="+SCHEMA);p.add("spring.datasource.username",()->"postgres");
        p.add("spring.datasource.password",()->"synthetic-test-password");p.add("spring.datasource.driver-class-name",()->"org.postgresql.Driver");
        p.add("spring.flyway.enabled",()->true);p.add("spring.flyway.schemas",()->SCHEMA);p.add("spring.flyway.default-schema",()->SCHEMA);
        p.add("spring.jpa.hibernate.ddl-auto",()->"validate");
    }
    @Test void schemaAtualV46Validado() { flyway.validate();assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("46"); }
    @AfterAll static void limparSchema() throws Exception {
        try(var c=DriverManager.getConnection(URL,"postgres","synthetic-test-password");var s=c.createStatement()){s.execute("drop schema if exists "+SCHEMA+" cascade");}
    }
}
