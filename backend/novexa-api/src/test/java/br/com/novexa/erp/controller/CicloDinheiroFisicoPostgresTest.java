package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.math.BigDecimal;
import java.sql.DriverManager;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

/** Mesmos contratos, rollback e corridas executados sobre Flyway real e Hibernate validate. */
@EnabledIfSystemProperty(named = "novexa.test.ciclo.jdbc-url", matches = "jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*")
class CicloDinheiroFisicoPostgresTest extends CicloDinheiroFisicoCaixaTest {
    private static final String URL = System.getProperty("novexa.test.ciclo.jdbc-url");
    private static final String USER = System.getProperty("novexa.test.ciclo.jdbc-user", "postgres");
    private static final String SCHEMA = "teste_ciclo_" + UUID.randomUUID().toString().replace("-", "");
    @Autowired JdbcTemplate jdbc;
    @Autowired Flyway flyway;

    @DynamicPropertySource static void postgres(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", () -> URL + "?currentSchema=" + SCHEMA);
        p.add("spring.datasource.username", () -> USER);
        p.add("spring.datasource.password", () -> "");
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        p.add("spring.flyway.enabled", () -> "true");
        p.add("spring.flyway.default-schema", () -> SCHEMA);
        p.add("spring.flyway.schemas", () -> SCHEMA);
    }

    @Test void flywayCompletoAteV49EHibernateValidate() {
        flyway.validate();
        assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("49");
        assertThat(jdbc.queryForObject("select count(*) from flyway_schema_history where success and type='SQL'", Integer.class)).isEqualTo(49);
    }

    @Test void bancoImpedeDuploConsumoVinculoDeOutroCaixaEOutroTenant() {
        var origem = sessaoService.abrir(caixaA1.getId(), new BigDecimal("70"), auth(operadorA1));
        sessaoService.fechar(caixaA1.getId(), origem.id(), new FechamentoCaixaDTO(new BigDecimal("70"), null,
                new EntregaCofreDTO(null, BigDecimal.ZERO, new BigDecimal("70"), null, null, false)), auth(operadorA1));
        var consumidora = sessaoService.abrir(caixaA1.getId(), new AberturaCaixaDTO(new BigDecimal("70"), UUID.randomUUID(), true,
                BigDecimal.ZERO, null, BigDecimal.ZERO, null), auth(operadorA2));
        var destino = sessoes.saveAndFlush(new SessaoCaixaEntity(caixaA2, gerenteA, new BigDecimal("70")));
        String sql = """
                insert into aberturas_caixa_origem(empresa_id,caixa_id,sessao_id,sessao_origem_troco_id,
                  usuario_id,chave_requisicao,valor_troco_herdado,data_criacao)
                values (?,?,?,?,?,?,70,current_timestamp)
                """;
        // Chave de origem já consumida: tentativa em sessão do mesmo Caixa, sem outra violação.
        sessaoService.fechar(caixaA1.getId(), consumidora.id(), new BigDecimal("70"), auth(gerenteA));
        var mesmoCaixa = sessaoService.abrir(caixaA1.getId(), new BigDecimal("70"), auth(gerenteA));
        assertThatThrownBy(() -> jdbc.update(sql, empresaA.getId(), caixaA1.getId(), mesmoCaixa.id(), origem.id(), gerenteA.getId(), UUID.randomUUID()))
                .hasMessageContaining("uk_abertura_origem_troco");
        // Outra origem não consumida permite verificar cada FK, sem mascarar com unicidade.
        var fonte = sessoes.saveAndFlush(new SessaoCaixaEntity(caixaB1, operadorB, BigDecimal.ZERO));
        assertThatThrownBy(() -> jdbc.update(sql, empresaA.getId(), caixaA2.getId(), destino.getId(), fonte.getId(), gerenteA.getId(), UUID.randomUUID()))
                .hasMessageContaining("fk_abertura_origem_troco");
        sessaoService.fechar(caixaA1.getId(), mesmoCaixa.id(), new BigDecimal("70"), auth(gerenteA));
        var outraFonte = sessaoService.abrir(caixaA1.getId(), BigDecimal.ZERO, auth(gerenteA));
        assertThatThrownBy(() -> jdbc.update(sql, empresaA.getId(), caixaA2.getId(), destino.getId(), outraFonte.id(), gerenteA.getId(), UUID.randomUUID()))
                .hasMessageContaining("fk_abertura_origem_troco");
    }

    @AfterAll static void removerSchema() throws Exception {
        try (var c = DriverManager.getConnection(URL, USER, ""); var s = c.createStatement()) {
            s.execute("drop schema if exists " + SCHEMA + " cascade");
        }
    }
}
