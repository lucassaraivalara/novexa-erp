package br.com.novexa.erp.controller;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.AutowireCapableBeanFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import br.com.novexa.erp.repository.*;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.jdbc.Sql;
import java.sql.DriverManager;
import java.util.UUID;

@EnabledIfSystemProperty(named = "novexa.test.pagamento-pix.jdbc-url", matches = "jdbc:postgresql:.*")
@SpringBootTest(properties = {"spring.jpa.open-in-view=false", "spring.jpa.show-sql=false",
        "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=60000"})
@AutoConfigureMockMvc
@Sql(statements = {
        "DELETE FROM formas_pagamento",
        "INSERT INTO formas_pagamento(id,descricao,tipo,ativo) VALUES (1,'Dinheiro','DINHEIRO',true),(2,'PIX','PIX',true),(3,'Debito','DEBITO',true),(4,'Credito','CREDITO',true),(5,'Boleto','BOLETO',true),(6,'Transferencia','TRANSFERENCIA',true)",
        "ALTER SEQUENCE formas_pagamento_id_seq RESTART WITH 7"
})
class PagamentoPixPostgresTest {
    @Autowired AutowireCapableBeanFactory beans;
    @MockitoSpyBean LancamentoFinanceiroRepository financeiro;
    @MockitoSpyBean PagamentoRepository pagamentos;
    @MockitoSpyBean MovimentacaoFinanceiraRepository movimentosFinanceiros;
    private VendaHttpTest fluxo;

    @BeforeEach
    void preparar() {
        // Reutiliza fixtures e verificacoes HTTP sem herdar toda a suite de Venda.
        fluxo = new VendaHttpTest();
        beans.autowireBean(fluxo);
        fluxo.financeiro = financeiro; fluxo.pagamentos = pagamentos; fluxo.movimentosFinanceiros = movimentosFinanceiros;
        fluxo.preparar();
    }
    @AfterEach void limpar() { fluxo.limpar(); }

    @ParameterizedTest @ValueSource(booleans = {false, true})
    void cicloPixCancelamentoPreservaHistoricoEAuditoria(boolean inativa) throws Exception {
        fluxo.cicloPixCancelamentoPreservaHistoricoEAuditoria(inativa);
    }
    @ParameterizedTest @ValueSource(booleans = {false, true})
    void confirmacaoPixUsaSnapshotMesmoAposTrocaDeDestinoEInativacao(boolean inativa) throws Exception {
        fluxo.confirmacaoPixUsaSnapshotMesmoAposTrocaDeDestinoEInativacao(inativa);
    }
    @Test void cicloPixFalhaNoCancelamentoReverteTodosEfeitos() throws Exception { fluxo.cicloPixFalhaNoCancelamentoReverteTodosEfeitos(); }
    @Test void cicloPixSaldoInsuficienteImpedeCancelamentoIntegral() throws Exception { fluxo.cicloPixSaldoInsuficienteImpedeCancelamentoIntegral(); }
    @Test void cicloPixBloqueiaEstornoIndividual() throws Exception { fluxo.cicloPixBloqueiaEstornoIndividual(); }
    @RepeatedTest(3) void cicloPixDuplaConfirmacaoConcorrente() throws Exception { fluxo.cicloPixDuplaConfirmacaoConcorrente(); }
    @RepeatedTest(3) void cicloPixConfirmacaoECancelamentoConcorrentes() throws Exception { fluxo.cicloPixConfirmacaoECancelamentoConcorrentes(); }
    @Test void confirmacaoPixFalhaDePersistenciaReverteSaldoEMovimento() throws Exception { fluxo.confirmacaoPixFalhaDePersistenciaReverteSaldoEMovimento(); }
    @Test void confirmacaoPixRejeitaCanceladoEOutroTenant() throws Exception { fluxo.confirmacaoPixRejeitaCanceladoEOutroTenant(); }
    private static final String SCHEMA = "teste_ciclo_pix_" + UUID.randomUUID().toString().replace("-", "");
    private static final String URL = System.getProperty("novexa.test.pagamento-pix.jdbc-url");
    private static final String USER = System.getProperty("novexa.test.pagamento-pix.jdbc-user", "postgres");
    private static final String PASSWORD = System.getProperty("novexa.test.pagamento-pix.jdbc-password", "");

    @DynamicPropertySource
    static void postgres(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", () -> URL + (URL.contains("?") ? "&" : "?") + "currentSchema=" + SCHEMA);
        properties.add("spring.datasource.username", () -> USER);
        properties.add("spring.datasource.password", () -> PASSWORD);
        properties.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        properties.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        properties.add("spring.flyway.enabled", () -> "true");
        properties.add("spring.flyway.default-schema", () -> SCHEMA);
        properties.add("spring.flyway.schemas", () -> SCHEMA);
    }

    @AfterAll
    static void removerSchemaDescartavel() throws Exception {
        try (var connection = DriverManager.getConnection(URL, USER, PASSWORD);
                var statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
        }
    }
}
