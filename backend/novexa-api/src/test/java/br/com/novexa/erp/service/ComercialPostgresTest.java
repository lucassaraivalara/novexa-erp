package br.com.novexa.erp.service;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.sql.DriverManager;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@EnabledIfSystemProperty(named = "novexa.test.admin.jdbc-url", matches = "jdbc:postgresql:.*")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@org.springframework.test.context.jdbc.Sql(statements = "SELECT 1")
@Import({VendaService.class, MovimentacaoEstoqueService.class, PagamentoService.class, FormaPagamentoService.class,
        CaixaOperacionalService.class, ConfirmacaoPagamentoPixService.class, RecebivelService.class,
        ProdutoService.class, EmpresaService.class})
class ComercialPostgresTest extends VendaServiceTest {
    private static final String SCHEMA = "teste_comercial_" + UUID.randomUUID().toString().replace("-", "");
    private static final String URL = System.getProperty("novexa.test.admin.jdbc-url");
    private static final String USER = System.getProperty("novexa.test.admin.jdbc-user", "postgres");
    private static final String PASSWORD = System.getProperty("novexa.test.admin.jdbc-password", "");
    @Autowired ProdutoService produtoService;
    @org.springframework.test.context.bean.override.mockito.MockitoBean
    br.com.novexa.erp.storage.ArquivoStorageService armazenamento;

    @DynamicPropertySource static void postgres(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", () -> URL + (URL.contains("?") ? "&" : "?") + "currentSchema=" + SCHEMA);
        p.add("spring.datasource.username", () -> USER);
        p.add("spring.datasource.password", () -> PASSWORD);
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        p.add("spring.flyway.enabled", () -> "true");
        p.add("spring.flyway.default-schema", () -> SCHEMA);
        p.add("spring.flyway.schemas", () -> SCHEMA);
    }

    @Test void buscaRapidaMantemTenantEIgnoraInativosInclusiveSemTermo() {
        var inativo = produto(empresa, "Produto inativo", "10", "10");
        inativo.setAtivo(false);
        produtos.saveAndFlush(inativo);
        produtos.saveAndFlush(produto(outra, "Produto externo", "10", "10"));
        assertThat(produtoService.buscarPorTermo(empresa.getId(), "Produto"))
                .extracting(p -> p.getId()).containsExactly(produto.getId());
        assertThat(produtoService.buscarPorTermo(empresa.getId(), ""))
                .extracting(p -> p.getId()).containsExactly(produto.getId());
    }

    @AfterAll static void limparSchema() throws Exception {
        try (var c = DriverManager.getConnection(URL, USER, PASSWORD); var s = c.createStatement()) {
            s.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
        }
    }
}
