package br.com.novexa.erp.controller;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.jdbc.Sql;
import java.sql.DriverManager;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "novexa.test.misto.jdbc-url", matches = "jdbc:postgresql:.*")
@Sql(statements = {"delete from formas_pagamento", """
    insert into formas_pagamento(id,descricao,tipo,ativo) values
        (1,'Dinheiro','DINHEIRO',true),(2,'PIX','PIX',true),
        (3,'Debito','DEBITO',true),(4,'Credito','CREDITO',true),
        (5,'Boleto','BOLETO',true),(6,'Transferencia','TRANSFERENCIA',true);
    """})
class PagamentoMistoPostgresTest extends VendaHttpTest {
    private static final String SCHEMA = "teste_misto_" + UUID.randomUUID().toString().replace("-", "");
    private static final String URL = System.getProperty("novexa.test.misto.jdbc-url");
    private static final String USER = System.getProperty("novexa.test.misto.jdbc-user", "postgres");
    private static final String PASSWORD = System.getenv("PGPASSWORD");

    @DynamicPropertySource static void postgres(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", () -> URL + (URL.contains("?") ? "&" : "?") + "currentSchema=" + SCHEMA);
        p.add("spring.datasource.username", () -> USER); p.add("spring.datasource.password", () -> PASSWORD);
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.jpa.hibernate.ddl-auto", () -> "validate"); p.add("spring.flyway.enabled", () -> "true");
        p.add("spring.flyway.default-schema", () -> SCHEMA); p.add("spring.flyway.schemas", () -> SCHEMA);
    }

    @Test void mistoPostgres18EConstraintSequencia() throws Exception {
        assertThat(jdbc.queryForObject("show server_version", String.class)).startsWith("18.");
        dinheiroGravaVendaEstoqueEFinanceiroUmaVezMesmoAoRepetir();
        assertThatThrownBy(() -> jdbc.update("""
            insert into pagamentos(empresa_id,venda_id,usuario_id,sequencia,chave_requisicao,forma_pagamento,
                forma_pagamento_id,valor,status,data_hora,valor_recebido,troco)
            select empresa_id,venda_id,usuario_id,sequencia,chave_requisicao,forma_pagamento,
                forma_pagamento_id,valor,status,data_hora,valor_recebido,troco from pagamentos
            """)).hasMessageContaining("uk_pagamento_venda_sequencia");
    }

    @RepeatedTest(3) void mistoConcorrenciaVendaAntesDoFechamento() throws Exception {
        vendaConfirmaEntradaAntesDeFechamentoConcorrente();
    }
    @RepeatedTest(3) void mistoConcorrenciaFechamentoAntesDaVenda() throws Exception {
        fechamentoConcorrentePrimeiroImpedeEntradaNaSessaoFechada();
    }

    @AfterAll static void limparSchema() throws Exception {
        try (var c = DriverManager.getConnection(URL, USER, PASSWORD); var s = c.createStatement()) {
            s.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
        }
    }
}
