package br.com.novexa.erp.controller;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.sql.DriverManager;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "novexa.test.recebivel.jdbc-url", matches = "jdbc:postgresql:.*")
class RecebivelPostgresTest extends RecebivelHttpTest {
    private static final String SCHEMA = "teste_recebivel_" + UUID.randomUUID().toString().replace("-", "");
    private static final String URL = System.getProperty("novexa.test.recebivel.jdbc-url");
    private static final String USER = System.getProperty("novexa.test.recebivel.jdbc-user", "postgres");
    private static final String PASSWORD = System.getProperty("novexa.test.recebivel.jdbc-password", "");
    @DynamicPropertySource static void postgres(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", () -> URL + (URL.contains("?") ? "&" : "?") + "currentSchema=" + SCHEMA);
        p.add("spring.datasource.username", () -> USER); p.add("spring.datasource.password", () -> PASSWORD);
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.jpa.hibernate.ddl-auto", () -> "validate"); p.add("spring.flyway.enabled", () -> "true");
        p.add("spring.flyway.default-schema", () -> SCHEMA); p.add("spring.flyway.schemas", () -> SCHEMA);
        p.add("spring.flyway.target", () -> "29");
    }
    @Test void constraintsImpedemDuplicidadeTenantIncorretoEValoresInvalidos() throws Exception {
        enviar(pedido("CARTAO_DEBITO"));
        assertThatThrownBy(() -> fluxo.jdbc.update("""
            insert into recebiveis(empresa_id,pagamento_id,venda_id,tipo,numero_parcela,total_parcelas,valor_bruto,data_venda,status,criado_em)
            select empresa_id,pagamento_id,venda_id,tipo,numero_parcela,total_parcelas,valor_bruto,data_venda,status,criado_em from recebiveis
            """)).hasMessageContaining("uk_recebivel_parcela");
        assertThatThrownBy(() -> fluxo.jdbc.update("update recebiveis set empresa_id=?", fluxo.outra.getId()))
                .hasMessageContaining("fk_recebivel_pagamento_venda_empresa");
        for (String alteracao : new String[]{"numero_parcela=0", "total_parcelas=0", "numero_parcela=2", "valor_bruto=0",
                "valor_liquido_previsto=-1", "tipo='PIX'", "status='OUTRO'"})
            assertThatThrownBy(() -> fluxo.jdbc.update("update recebiveis set " + alteracao))
                    .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
    @AfterAll static void limparSchema() throws Exception {
        try (var c = DriverManager.getConnection(URL, USER, PASSWORD); var s = c.createStatement()) {
            s.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
        }
    }
}
