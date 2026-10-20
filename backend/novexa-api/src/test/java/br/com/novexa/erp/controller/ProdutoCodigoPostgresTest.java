package br.com.novexa.erp.controller;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.http.MediaType;

import java.sql.DriverManager;
import java.util.*;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@EnabledIfSystemProperty(named = "novexa.test.produto-codigo.jdbc-url", matches = "jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ProdutoCodigoPostgresTest extends ProdutoFornecedorHttpTest {
    private static final String URL = System.getProperty("novexa.test.produto-codigo.jdbc-url");
    private static final String USER = System.getProperty("novexa.test.produto-codigo.jdbc-user", "novexa_test");
    private static final String SCHEMA = "teste_produto_codigo_" + UUID.randomUUID().toString().replace("-", "");
    @Autowired JdbcTemplate jdbc;

    @DynamicPropertySource static void postgres(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", () -> URL + "?currentSchema=" + SCHEMA);
        p.add("spring.datasource.username", () -> USER); p.add("spring.datasource.password", () -> "");
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.jpa.hibernate.ddl-auto", () -> "validate"); p.add("spring.flyway.enabled", () -> "true");
        p.add("spring.flyway.default-schema", () -> SCHEMA); p.add("spring.flyway.schemas", () -> SCHEMA);
        p.add("spring.jpa.show-sql", () -> "false");
    }

    String codigo(long id) throws Exception {
        var r = mvc.perform(get("/produtos/" + id).header("Authorization", tokenA)).andExpect(status().isOk()).andReturn();
        return json.readTree(r.getResponse().getContentAsString()).get("codigoInterno").asText();
    }

    @Test void geraNoPostRetornaConsultaBuscaPdvEPaginaSemAlterarEstoque() throws Exception {
        for (var entrada : Arrays.asList(null, "", "   ")) {
            var d = dados(Map.of()); d.put("codigoInterno", entrada);
            var r = mvc.perform(post("/produtos").header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(d))).andExpect(status().isCreated()).andReturn();
            var p = json.readTree(r.getResponse().getContentAsString());
            String c = p.get("codigoInterno").asText();
            assertThat(c).matches("[1-9][0-9]*");
            assertThat(codigo(p.get("id").asLong())).isEqualTo(c);
            mvc.perform(get("/produtos/buscar").header("Authorization", tokenA).param("termo", c))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(p.get("id").asLong()));
        }
        mvc.perform(get("/produtos").header("Authorization", tokenA).param("sort", "codigoInterno,asc").param("size", "2").param("page", "1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(3)).andExpect(jsonPath("$.items[0].codigoInterno").value("3"));
        assertThat(jdbc.queryForObject("select sum(estoque_atual) from produtos where empresa_id=?", java.math.BigDecimal.class, empresaA.getId())).isEqualByComparingTo("0");
        assertThat(jdbc.queryForObject("select count(*) from movimentacoes_estoque where empresa_id=?", Integer.class, empresaA.getId())).isZero();
    }

    @Test void preservaManualRejeitaDuplicadoEPreservaTenant() throws Exception {
        long id = criar(tokenA, Map.of("codigoInterno", " sku-01 "));
        assertThat(codigo(id)).isEqualTo("SKU-01"); // normalização anterior preservada
        mvc.perform(post("/produtos").header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(dados(Map.of("codigoInterno", "SKU-01")))))
            .andExpect(status().isConflict()).andExpect(content().string(org.hamcrest.Matchers.containsString("código interno")));
        criar(tokenB, Map.of("codigoInterno", "SKU-01"));
        mvc.perform(get("/produtos/" + id).header("Authorization", tokenB)).andExpect(status().isNotFound());
        long outro = criar(tokenB, Map.of());
        mvc.perform(get("/produtos/" + outro).header("Authorization", tokenB)).andExpect(jsonPath("$.codigoInterno").value("1"));
        for (String invalido : List.of("---", "A\nB"))
            mvc.perform(post("/produtos").header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(dados(Map.of("codigoInterno", invalido))))).andExpect(status().isBadRequest());
    }

    @Test void edicaoVaziaPreservaCodigoEEdicaoExplicitaAvancaNumeradorSemReuso() throws Exception {
        long id = criar(tokenA, Map.of("codigoInterno", "500"));
        for (String vazio : List.of("", "   ")) {
            mvc.perform(put("/produtos/" + id).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(dados(Map.of("codigoInterno", vazio)))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.codigoInterno").value("500"));
        }
        mvc.perform(put("/produtos/" + id).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(dados(Map.of("codigoInterno", "SKU-EDITADO"))))).andExpect(status().isOk());
        assertThat(codigo(criar(tokenA, Map.of()))).isEqualTo("501");
        long outro = criar(tokenA, Map.of());
        mvc.perform(put("/produtos/" + outro).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(dados(Map.of("codigoInterno", "SKU-EDITADO"))))).andExpect(status().isConflict());
        mvc.perform(delete("/produtos/" + outro).header("Authorization", tokenA)).andExpect(status().isNoContent());
        assertThat(codigo(criar(tokenA, Map.of()))).isEqualTo("503");
    }

    @Test void kitRecebeCodigoSemSaldoFisicoEHistoricoMantemIds() throws Exception {
        long componente = criar(tokenA, Map.of("codigoInterno", "FISICO"));
        long kit = criar(tokenA, Map.of("composto", true, "componentes", List.of(Map.of(
            "produtoId", componente, "quantidade", 2, "fator", 1, "unidade", "UN"))));
        assertThat(codigo(kit)).isEqualTo("1");
        mvc.perform(get("/produtos/" + kit + "/composicoes").header("Authorization", tokenA))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].produtoId").value(componente));
    }

    @Test void concorrenciaPrimeiroCadastroManualAutomaticoERollbackSemDuplicacao() throws Exception {
        long empresa;
        try (var c = DriverManager.getConnection(URL + "?currentSchema=" + SCHEMA, USER, ""); var s = c.createStatement()) {
            try (var r = s.executeQuery("insert into empresas(razao_social,ativo) values ('Concorrencia sintetica',true) returning id")) { r.next(); empresa = r.getLong(1); }
        }
        var pool = Executors.newFixedThreadPool(2);
        try {
            var inicio = new CountDownLatch(1);
            Callable<String> cadastrar = () -> {
                inicio.await();
                try (var c = DriverManager.getConnection(URL + "?currentSchema=" + SCHEMA, USER, "");
                     var s = c.prepareStatement("insert into produtos(empresa_id,nome,unidade_medida,preco_venda,data_cadastro) values (?,'Concorrente','UN',1,current_timestamp) returning codigo_interno")) {
                    s.setLong(1, empresa); try (var r = s.executeQuery()) { r.next(); return r.getString(1); }
                }
            };
            var a = pool.submit(cadastrar); var b = pool.submit(cadastrar); inicio.countDown();
            assertThat(Set.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS))).containsExactlyInAnyOrder("1", "2");
            try (var c = DriverManager.getConnection(URL + "?currentSchema=" + SCHEMA, USER, "")) {
                c.setAutoCommit(false);
                try (var s = c.createStatement()) {
                    s.executeUpdate("insert into produtos(empresa_id,nome,unidade_medida,preco_venda,data_cadastro) values ("+empresa+",'Revertido','UN',1,current_timestamp)");
                }
                c.rollback();
                try (var s = c.createStatement(); var r = s.executeQuery("select ultimo_codigo from produto_codigo_numeradores where empresa_id="+empresa)) {
                    r.next(); assertThat(r.getInt(1)).isEqualTo(2);
                }
            }
        } finally { pool.shutdownNow(); }
    }

    @Test void upgradeV46PreservaLegadoEInicializaAcimaDosNumericosImportados() throws Exception {
        String schema = "teste_upgrade_codigo_" + UUID.randomUUID().toString().replace("-", "");
        try {
            var antigo = Flyway.configure().dataSource(URL, USER, "").schemas(schema).defaultSchema(schema).target("46").load(); antigo.migrate();
            try (var c = DriverManager.getConnection(URL + "?currentSchema=" + schema, USER, ""); var s = c.createStatement()) {
                s.executeUpdate("insert into empresas(id,razao_social,ativo) values (900001,'Legada sintetica',true)");
                s.executeUpdate("insert into produtos(empresa_id,nome,codigo_interno,unidade_medida,preco_venda,data_cadastro) values (900001,'Importado','8000','UN',10,current_timestamp),(900001,'Legado sem codigo',null,'UN',10,current_timestamp)");
            }
            var atual = Flyway.configure().dataSource(URL, USER, "").schemas(schema).defaultSchema(schema).load(); atual.migrate(); atual.validate();
            try (var c = DriverManager.getConnection(URL + "?currentSchema=" + schema, USER, ""); var s = c.createStatement()) {
                try (var r = s.executeQuery("select codigo_interno from produtos where nome='Legado sem codigo'")) { r.next(); assertThat(r.getString(1)).isNull(); }
                try (var r = s.executeQuery("insert into produtos(empresa_id,nome,unidade_medida,preco_venda,data_cadastro) values (900001,'Novo','UN',10,current_timestamp) returning codigo_interno")) { r.next(); assertThat(r.getString(1)).isEqualTo("8001"); }
                try (var r = s.executeQuery("select codigo_interno from produtos where nome='Importado'")) { r.next(); assertThat(r.getString(1)).isEqualTo("8000"); }
            }
        } finally { try (var c = DriverManager.getConnection(URL, USER, ""); var s = c.createStatement()) { s.execute("drop schema if exists " + schema + " cascade"); } }
    }

    @Test @Order(Integer.MAX_VALUE)
    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void criarKitConcorrenteComEdicaoDoCodigoDoComponenteNaoInverteLocks() throws Exception {
        long componente = criar(tokenA, Map.of("codigoInterno", "COMPONENTE"));
        var pool = Executors.newSingleThreadExecutor();
        try (var c = DriverManager.getConnection(URL + "?currentSchema=" + SCHEMA, USER, "")) {
            c.setAutoCommit(false);
            try (var s = c.prepareStatement("select id from produtos where id=? for update")) {
                s.setLong(1, componente); s.executeQuery().close();
            }
            var criando = pool.submit(() -> mvc.perform(post("/produtos").header("Authorization", tokenA)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dados(Map.of(
                    "composto", true, "componentes", List.of(Map.of("produtoId", componente,
                        "quantidade", 1, "fator", 1, "unidade", "UN")))))))
                .andExpect(status().isCreated()).andReturn());
            long limite = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
            boolean aguardando = false;
            while (!aguardando && System.nanoTime() < limite) {
                aguardando = Boolean.TRUE.equals(jdbc.queryForObject("select exists (select 1 from pg_stat_activity " +
                    "where datname=current_database() and wait_event_type='Lock' and query like '%produtos%')", Boolean.class));
                if (!aguardando) Thread.sleep(25);
            }
            assertThat(aguardando).as("Criação deve aguardar o lock do componente").isTrue();
            try (var s = c.prepareStatement("update produtos set codigo_interno='3100' where id=?")) {
                s.setLong(1, componente); s.executeUpdate();
            }
            c.commit();
            var kit = json.readTree(criando.get(15, TimeUnit.SECONDS).getResponse().getContentAsString());
            assertThat(kit.get("codigoInterno").asText()).isEqualTo("3101");
            assertThat(kit.get("componentes").size()).isEqualTo(1);
            assertThat(jdbc.queryForObject("select count(*) from movimentacoes_estoque where empresa_id=?", Integer.class, empresaA.getId())).isZero();
        } finally { pool.shutdownNow(); }
    }

    @AfterAll static void removerSchema() throws Exception {
        try (var c = DriverManager.getConnection(URL, USER, ""); var s = c.createStatement()) { s.execute("drop schema if exists " + SCHEMA + " cascade"); }
    }
}
