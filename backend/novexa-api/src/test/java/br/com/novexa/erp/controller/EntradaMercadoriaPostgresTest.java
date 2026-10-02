package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.math.BigDecimal;
import java.sql.DriverManager;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@EnabledIfSystemProperty(named = "novexa.test.entrada.jdbc-url", matches = "jdbc:postgresql:.*")
class EntradaMercadoriaPostgresTest extends EntradaMercadoriaHttpTest {
    static final String URL = System.getProperty("novexa.test.entrada.jdbc-url");
    static final String USER = System.getProperty("novexa.test.entrada.jdbc-user", "postgres");
    static final String PASSWORD = System.getProperty("novexa.test.entrada.jdbc-password", "");
    static final String SCHEMA = "teste_entrada_" + UUID.randomUUID().toString().replace("-", "");
    @Autowired CaixaRepository caixas;
    @Autowired SessaoCaixaRepository sessoes;

    @DynamicPropertySource static void postgres(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", () -> URL + (URL.contains("?") ? "&" : "?") + "currentSchema=" + SCHEMA);
        p.add("spring.datasource.username", () -> USER); p.add("spring.datasource.password", () -> PASSWORD);
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.jpa.hibernate.ddl-auto", () -> "validate"); p.add("spring.flyway.enabled", () -> "true");
        p.add("spring.flyway.baseline-on-migrate", () -> "false"); p.add("spring.flyway.default-schema", () -> SCHEMA);
        p.add("spring.flyway.schemas", () -> SCHEMA);
    }
    @AfterAll static void limparSchema() throws Exception {
        try (var c = DriverManager.getConnection(URL,USER,PASSWORD); var s = c.createStatement()) { s.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE"); }
    }
    @Test void flywayDoZeroHibernateValidateEPostgres18() {
        assertThat(jdbc.queryForObject("select count(*) from flyway_schema_history where version='34' and success",Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select version()",String.class)).contains("PostgreSQL 18");
    }
    @Test void chaveDuplicadaNoTenantConflitaMasOutroTenantPermite() throws Exception {
        var p = pedido(); p.put("chaveAcessoNfe","1".repeat(44)); criar(p).andExpect(status().isCreated()); criar(p).andExpect(status().isConflict());
        p.put("fornecedorId",fornecedorB.getId()); p.put("itens",List.of(item(produtoB,"1","1")));
        criar(p,authorizationB).andExpect(status().isCreated()); assertThat(entradas.count()).isEqualTo(2);
    }
    @Test void notaSerieNulaEVaziaSaoIguaisOutrosFornecedoresOuTenantsPermitem() throws Exception {
        var p = pedido(); p.put("numeroNota","100"); criar(p).andExpect(status().isCreated());
        p.put("serie","  "); criar(p).andExpect(status().isConflict());
        p.put("serie","1"); criar(p).andExpect(status().isCreated());
        p.remove("serie"); p.put("fornecedorId",fornecedor(empresa,"Outro fornecedor").getId()); criar(p).andExpect(status().isCreated());
        p.put("fornecedorId",fornecedorB.getId()); p.put("itens",List.of(item(produtoB,"1","1")));
        criar(p,authorizationB).andExpect(status().isCreated());
    }
    @Test void bancoImpedeVinculosCrossTenantECrossProduto() throws Exception {
        long id = criarEntrada(); operacao(id,"confirmar").andExpect(status().isOk());
        assertThatThrownBy(() -> jdbc.update("update entradas_mercadoria set fornecedor_id=? where id=?",fornecedorB.getId(),id))
                .hasMessageContaining("fk_entrada_fornecedor_empresa");
        assertThatThrownBy(() -> jdbc.update("update itens_entrada_mercadoria set produto_id=? where entrada_id=?",produtoB.getId(),id))
                .hasMessageContaining("fk_item_entrada");
        assertThatThrownBy(() -> jdbc.update("update itens_entrada_mercadoria set empresa_id=? where entrada_id=?",outra.getId(),id))
                .hasMessageContaining("fk_item_entrada");
        assertThatThrownBy(() -> jdbc.update("update itens_entrada_mercadoria set produto_id=? where entrada_id=?",produto2.getId(),id))
                .hasMessageContaining("fk_item_entrada_movimento");
        assertThatThrownBy(() -> jdbc.update("update itens_entrada_mercadoria set quantidade=0 where entrada_id=?",id)).hasMessageContaining("ck_item_entrada");
    }
    @Test void quatroDisputasDeDuplaConfirmacaoProduzemUmaEntradaPorRascunho() throws Exception {
        for (int i=0;i<4;i++) {
            long id = criarEntrada(); var resultados = disputar(() -> statusOperacao(id,"confirmar"), () -> statusOperacao(id,"confirmar"));
            assertThat(resultados).containsExactlyInAnyOrder(200,200);
            assertThat(saldo(produto)).isEqualByComparingTo(BigDecimal.TEN.add(new BigDecimal("5").multiply(BigDecimal.valueOf(i+1))));
            assertThat(movimentos.count()).isEqualTo(i+1);
        }
    }
    @Test void duasCriacoesComMesmaChaveRetornamMesmoRascunho() throws Exception {
        var p = pedido(); p.put("chaveRequisicao",UUID.randomUUID());
        assertThat(disputar(() -> criar(p).andReturn().getResponse().getStatus(),
                () -> criar(p).andReturn().getResponse().getStatus())).containsExactly(201,201);
        assertThat(entradas.count()).isEqualTo(1); assertThat(movimentos.count()).isZero();
    }
    @Test void quatroDisputasDeDuploCancelamentoProduzemUmaReversaoPorEntrada() throws Exception {
        for (int i=0;i<4;i++) {
            long id = criarEntrada(); operacao(id,"confirmar").andExpect(status().isOk());
            assertThat(disputar(() -> statusOperacao(id,"cancelar"), () -> statusOperacao(id,"cancelar"))).containsExactly(200,200);
            assertThat(saldo(produto)).isEqualByComparingTo("10"); assertThat(movimentos.count()).isEqualTo(2*(i+1));
        }
    }
    @Test void confirmarContraEditarSerializaDadosConfirmados() throws Exception {
        for (int i=0;i<4;i++) {
            long id = criarEntrada(); var p = pedido(); p.put("itens",List.of(item(produto,"7","4")));
            var resultados = disputar(() -> statusOperacao(id,"confirmar"), () -> editar(id,p).andReturn().getResponse().getStatus());
            assertThat(resultados.getFirst()).isEqualTo(200); assertThat(resultados.get(1)).isIn(200,409);
            var detalhe = mvc.perform(get("/estoque/entradas/"+id).header("Authorization",authorization)).andReturn();
            String quantidade = json.readTree(detalhe.getResponse().getContentAsString()).get("itens").get(0).get("quantidade").asText();
            assertThat(new BigDecimal(quantidade)).isEqualByComparingTo(resultados.get(1)==200 ? "7" : "5");
            operacao(id,"cancelar").andExpect(status().isOk()); assertThat(saldo(produto)).isEqualByComparingTo("10");
        }
    }
    @Test void confirmarContraCancelarNaoDeixaEstadoParcial() throws Exception {
        for (int i=0;i<4;i++) {
            long id = criarEntrada(); var resultados = disputar(() -> statusOperacao(id,"confirmar"), () -> statusOperacao(id,"cancelar"));
            assertThat(resultados.getFirst()).isEqualTo(200); assertThat(resultados.get(1)).isIn(200,409);
            if (resultados.get(1)==409) operacao(id,"cancelar").andExpect(status().isOk());
            assertThat(saldo(produto)).isEqualByComparingTo("10"); assertThat(movimentos.count()).isEqualTo(2*(i+1));
        }
    }
    @Test void cancelamentosDeEntradasDistintasComProdutosEmOrdemInversaNaoDeadlockam() throws Exception {
        var p = pedido(); p.put("itens",List.of(item(produto,"2","4"),item(produto2,"3","5")));
        long a = id(criar(p).andExpect(status().isCreated())); p.put("itens",List.of(item(produto2,"3","5"),item(produto,"2","4")));
        long b = id(criar(p).andExpect(status().isCreated()));
        assertThat(disputar(() -> statusOperacao(a,"confirmar"), () -> statusOperacao(b,"confirmar"))).containsExactly(200,200);
        assertThat(disputar(() -> statusOperacao(a,"cancelar"), () -> statusOperacao(b,"cancelar"))).containsExactly(200,200);
        assertThat(saldo(produto)).isEqualByComparingTo("10"); assertThat(saldo(produto2)).isEqualByComparingTo("10");
        assertThat(movimentos.count()).isEqualTo(8);
    }
    @Test void entradaConcorrendoComVendaRealPreservaAmbasMovimentacoes() throws Exception {
        var operador = usuarios.findAll().stream().filter(u -> u.getEmpresa().getId().equals(empresa.getId())).findFirst().orElseThrow();
        var caixa = new CaixaEntity(); caixa.setEmpresa(empresa); caixa.setDescricao("Caixa de teste");
        sessoes.saveAndFlush(new SessaoCaixaEntity(caixas.saveAndFlush(caixa),operador,BigDecimal.ZERO));
        for (int i=0;i<4;i++) {
            long id = criarEntrada(); var venda = new HashMap<String,Object>(Map.of("chaveRequisicao",UUID.randomUUID(),
                    "itens",List.of(Map.of("produtoId",produto.getId(),"quantidade",2,"precoUnitarioEsperado",10)),
                    "desconto",0,"totalEsperado",20,"formaPagamento","DINHEIRO","valorRecebido",20));
            assertThat(disputar(() -> statusOperacao(id,"confirmar"), () -> mvc.perform(post("/vendas").header("Authorization",authorization)
                    .contentType(org.springframework.http.MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(venda)))
                    .andReturn().getResponse().getStatus())).containsExactly(200,201);
            assertThat(saldo(produto)).isEqualByComparingTo(BigDecimal.TEN.add(BigDecimal.valueOf(3L*(i+1))));
            assertThat(movimentos.count()).isEqualTo(2*(i+1));
        }
    }
    private int statusOperacao(long id,String acao) throws Exception { return operacao(id,acao).andReturn().getResponse().getStatus(); }
    private List<Integer> disputar(Callable<Integer> a, Callable<Integer> b) throws Exception {
        var pool = Executors.newFixedThreadPool(2); var iniciar = new CountDownLatch(1);
        try {
            var x = pool.submit(() -> { iniciar.await(); return a.call(); }); var y = pool.submit(() -> { iniciar.await(); return b.call(); });
            iniciar.countDown(); return List.of(x.get(25,TimeUnit.SECONDS),y.get(25,TimeUnit.SECONDS));
        } finally { pool.shutdownNow(); assertThat(pool.awaitTermination(10,TimeUnit.SECONDS)).isTrue(); }
    }
}
