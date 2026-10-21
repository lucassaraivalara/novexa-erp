package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.service.LiquidacaoAutomaticaCartaoScheduler;
import br.com.novexa.erp.time.TempoNovexa;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.MockedStatic;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.AutowireCapableBeanFactory;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.context.jdbc.Sql;
import java.math.BigDecimal;
import java.sql.DriverManager;
import java.time.*;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@EnabledIfSystemProperty(named = "novexa.test.tempo.jdbc-url", matches = "jdbc:postgresql://(?:localhost|127\\.0\\.0\\.1):.*")
@SpringBootTest(properties = {"spring.jpa.open-in-view=false", "spring.jpa.show-sql=false",
        "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=60000",
        "supabase.url=http://127.0.0.1:9", "supabase.secret-key=synthetic-time-test", "supabase.bucket=local"})
@TestPropertySource(locations = "file:src/main/resources/application.properties")
@AutoConfigureMockMvc
@Sql(statements = {"DELETE FROM formas_pagamento", "INSERT INTO formas_pagamento(id,descricao,tipo,ativo) VALUES "
        + "(1,'Dinheiro','DINHEIRO',true),(2,'PIX','PIX',true),(3,'Debito','DEBITO',true),"
        + "(4,'Credito','CREDITO',true),(5,'Boleto','BOLETO',true),(6,'Transferencia','TRANSFERENCIA',true)"})
class HorarioBrasiliaPostgresTest {
    private static final String URL = System.getProperty("novexa.test.tempo.jdbc-url");
    private static final String SCHEMA = "teste_tempo_" + UUID.randomUUID().toString().replace("-", "");
    @Autowired AutowireCapableBeanFactory beans;
    @Autowired Flyway flyway;
    @Autowired LiquidacaoAutomaticaCartaoScheduler scheduler;
    @MockitoSpyBean PagamentoRepository pagamentos;
    @MockitoSpyBean MovimentacaoFinanceiraRepository movimentosFinanceiros;
    @MockitoSpyBean MovimentacaoCaixaRepository movimentosCaixa;
    private VendaHttpTest f;
    private MockedStatic<TempoNovexa> tempo;

    @DynamicPropertySource static void postgres(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", () -> URL + "?currentSchema=" + SCHEMA);
        p.add("spring.datasource.username", () -> "postgres"); p.add("spring.datasource.password", () -> "");
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.flyway.schemas", () -> SCHEMA); p.add("spring.flyway.default-schema", () -> SCHEMA);
        p.add("spring.jpa.hibernate.ddl-auto", () -> "validate"); p.add("spring.flyway.enabled", () -> "true");
    }
    private void instante(String valor) {
        tempo.when(TempoNovexa::relogio).thenReturn(Clock.fixed(Instant.parse(valor), ZoneOffset.UTC));
    }
    @BeforeEach void preparar() {
        tempo = mockStatic(TempoNovexa.class, CALLS_REAL_METHODS);
        instante("2026-10-21T17:03:00Z");
        f = new VendaHttpTest(); beans.autowireBean(f);
        f.pagamentos = pagamentos; f.movimentosFinanceiros = movimentosFinanceiros; f.movimentosCaixa = movimentosCaixa;
        f.preparar();
    }
    @AfterEach void limpar() {
        try { f.jdbc.update("delete from recolhimentos_cofre"); f.limpar(); }
        finally { tempo.close(); }
    }
    private LocalDateTime salvo(String tabela, String coluna) {
        return f.jdbc.queryForObject("select " + coluna + " from " + tabela + " limit 1", LocalDateTime.class);
    }

    @ParameterizedTest @ValueSource(longs = {1, 2, 4})
    void horario1403PersisteRetornaEFiltraVendaEstoquePagamentoEFinanceiro(long forma) throws Exception {
        var esperado = LocalDateTime.of(2026, 10, 21, 14, 3);
        long id = f.vendaConfigurada(f.configuracao(f.empresa, forma, true), forma);
        f.mvc.perform(get("/vendas/" + id).header("Authorization", f.authorization)).andExpect(status().isOk())
                .andExpect(jsonPath("$.dataHora").value("2026-10-21T14:03:00"));
        for (var tabela : new String[]{"vendas", "pagamentos", "movimentacoes_estoque"})
            assertThat(salvo(tabela, "data_hora")).isEqualTo(esperado);
        assertThat(salvo("sessoes_caixa", "data_abertura")).isEqualTo(esperado);
        if (forma == 2) {
            f.mvc.perform(post("/financeiro/pagamentos/" + pagamentos.findAll().getFirst().getId() + "/confirmar-recebimento")
                    .header("Authorization", f.authorization)).andExpect(status().isOk());
            assertThat(salvo("movimentacoes_financeiras", "data_criacao")).isEqualTo(esperado);
            assertThat(f.jdbc.queryForObject("select data_movimento from movimentacoes_financeiras", LocalDate.class))
                    .isEqualTo(esperado.toLocalDate());
        }
        if (forma == 4) {
            assertThat(salvo("recebiveis", "criado_em")).isEqualTo(esperado);
            assertThat(f.jdbc.queryForObject("select data_prevista_recebimento from recebiveis", LocalDate.class))
                    .isEqualTo(esperado.toLocalDate());
        }
        flyway.validate();
        assertThat(f.jdbc.queryForObject("show time zone", String.class)).isEqualTo("America/Sao_Paulo");
    }

    @Test void aberturaEFechamentoRetornamHorarioCivilSemConversaoJdbc() throws Exception {
        var s = f.sessoes.findAll().getFirst();
        instante("2026-10-21T18:03:00Z");
        f.mvc.perform(post("/financeiro/caixas/" + s.getCaixa().getId() + "/sessoes/" + s.getId() + "/fechar")
                .header("Authorization", f.authorization).contentType("application/json").content("{\"saldoFinal\":0}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.dataAbertura").value("2026-10-21T14:03:00"))
                .andExpect(jsonPath("$.dataFechamento").value("2026-10-21T15:03:00"));
        assertThat(salvo("sessoes_caixa", "data_fechamento")).isEqualTo(LocalDateTime.of(2026, 10, 21, 15, 3));
    }

    @Test void filtrosEDashboardRespeitamMeiaNoiteBrasiliaComJvmUtc() throws Exception {
        var config = f.configuracao(f.empresa, 1, true);
        instante("2026-10-22T02:59:59Z"); f.vendaConfigurada(config, 1);
        instante("2026-10-22T03:00:00Z"); f.vendaConfigurada(config, 1);
        for (var dia : new String[]{"2026-10-21", "2026-10-22"})
            f.mvc.perform(get("/vendas").param("dataInicial", dia).param("dataFinal", dia)
                    .header("Authorization", f.authorization)).andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1));
        f.mvc.perform(get("/dashboard/resumo").header("Authorization", f.authorization)).andExpect(status().isOk())
                .andExpect(jsonPath("$.quantidadeVendasHoje").value(1)).andExpect(jsonPath("$.faturamentoHoje").value(20));
    }

    @Test void schedulerSomenteLiquidaAoAtingirDiaPrevistoEmBrasilia() throws Exception {
        f.empresa.configurarRecebimentos(ModoRecebimentoFinanceiro.SIMPLIFICADO, ModoConferenciaFechamento.TOTAL, false);
        f.empresas.saveAndFlush(f.empresa);
        var config = f.configuracao(f.empresa, 4, true);
        config.atualizarCondicoesCartao(BigDecimal.ZERO, BigDecimal.ZERO, 1); f.configuracoes.saveAndFlush(config);
        f.vendaConfigurada(config, 4);
        instante("2026-10-22T02:59:59Z"); scheduler.processarVencidos();
        assertThat(movimentosFinanceiros.count()).isZero();
        instante("2026-10-22T03:00:00Z"); scheduler.processarVencidos();
        assertThat(movimentosFinanceiros.count()).isEqualTo(1);
        assertThat(salvo("movimentacoes_financeiras", "data_criacao")).isEqualTo(LocalDateTime.of(2026, 10, 22, 0, 0));
        scheduler.processarVencidos(); assertThat(movimentosFinanceiros.count()).isEqualTo(1);
    }

    @AfterAll static void descartarSchema() throws Exception {
        try (var c = DriverManager.getConnection(URL, "postgres", ""); var s = c.createStatement()) {
            s.execute("DROP SCHEMA " + SCHEMA + " CASCADE");
        }
    }
}
