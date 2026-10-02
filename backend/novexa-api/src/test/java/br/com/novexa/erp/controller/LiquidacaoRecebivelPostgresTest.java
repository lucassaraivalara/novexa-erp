package br.com.novexa.erp.controller;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.sql.DriverManager;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named = "novexa.test.recebivel.jdbc-url", matches = "jdbc:postgresql:.*")
class LiquidacaoRecebivelPostgresTest extends LiquidacaoRecebivelHttpTest {
    private static final String SCHEMA = "teste_liquidacao_" + UUID.randomUUID().toString().replace("-", "");
    private static final String URL = System.getProperty("novexa.test.recebivel.jdbc-url");
    private static final String USER = System.getProperty("novexa.test.recebivel.jdbc-user", "postgres");
    private static final String PASSWORD = System.getProperty("novexa.test.recebivel.jdbc-password", "");
    @DynamicPropertySource static void postgres(DynamicPropertyRegistry p) {
        // A aplicacao deve completar o upgrade V30 -> V31 e executar Hibernate validate.
        Flyway.configure().dataSource(URL, USER, PASSWORD).schemas(SCHEMA).defaultSchema(SCHEMA)
                .target("30").load().migrate();
        p.add("spring.datasource.url", () -> URL + (URL.contains("?") ? "&" : "?") + "currentSchema=" + SCHEMA);
        p.add("spring.datasource.username", () -> USER); p.add("spring.datasource.password", () -> PASSWORD);
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.jpa.hibernate.ddl-auto", () -> "validate"); p.add("spring.flyway.enabled", () -> "true");
        p.add("spring.flyway.default-schema", () -> SCHEMA); p.add("spring.flyway.schemas", () -> SCHEMA);
    }
    @RepeatedTest(5) void duasLiquidacoes() throws Exception { concorrencia(false); }
    @RepeatedTest(5) void liquidacaoVersusCancelamento() throws Exception { concorrencia(true); }
    @RepeatedTest(5) void duasLiquidacoesComTaxas() throws Exception { concorrenciaComTaxas(false); }
    @RepeatedTest(5) void liquidacaoComTaxasVersusCancelamento() throws Exception { concorrenciaComTaxas(true); }
    @Test void bancoImpedeDuplaEntradaEOrigemIncoerente() throws Exception {
        long id = prepararCartao(); liquidar(id).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk());
        assertThatThrownBy(() -> fluxo.jdbc.update("""
            insert into movimentacoes_financeiras(empresa_id,conta_financeira_id,tipo,origem,descricao,valor,data_movimento,usuario_id,data_criacao,estornada,recebivel_id)
            select empresa_id,conta_financeira_id,tipo,origem,descricao,valor,data_movimento,usuario_id,data_criacao,estornada,recebivel_id from movimentacoes_financeiras
            """)).hasMessageContaining("uk_mov_fin_recebivel");
        assertThatThrownBy(() -> fluxo.jdbc.update("update movimentacoes_financeiras set tipo='SAIDA'"))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThatThrownBy(() -> fluxo.jdbc.update("update movimentacoes_financeiras set origem='MANUAL'"))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThatThrownBy(() -> fluxo.jdbc.update("update recebiveis set usuario_liquidacao_id=NULL"))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
    @AfterAll static void limparSchema() throws Exception {
        try (var c = DriverManager.getConnection(URL, USER, PASSWORD); var s = c.createStatement()) {
            s.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
        }
    }
}
