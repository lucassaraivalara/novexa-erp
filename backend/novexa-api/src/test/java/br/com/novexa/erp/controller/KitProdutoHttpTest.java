package br.com.novexa.erp.controller;

import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class KitProdutoHttpTest extends VendaHttpTest {
    @Test void capacidadeComposicaoExigeAutenticacaoEConfirmaContrato() throws Exception {
        mvc.perform(get("/produtos/composicao/capacidade")).andExpect(status().isUnauthorized());
        mvc.perform(get("/produtos/composicao/capacidade").header(HttpHeaders.AUTHORIZATION,authorization))
            .andExpect(status().isOk()).andExpect(jsonPath("$.habilitado").value(true));
    }
    @Test void rascunhoServidorFaturaKitUmaVezSemDuplicarConsumos() throws Exception {
        long id=kit(2,1,"UN");var aberto=mvc.perform(post("/vendas/abertas").header(HttpHeaders.AUTHORIZATION,authorization)).andExpect(status().isCreated()).andReturn();
        long venda=json.readTree(aberto.getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(post("/vendas/"+venda+"/itens").header(HttpHeaders.AUTHORIZATION,authorization).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(Map.of("produtoId",id,"quantidade",3)))).andExpect(status().isOk());
        assertThat(movimentos.count()).isZero();
        var pagamento=Map.of("chaveRequisicao",UUID.randomUUID(),"totalEsperado",30,"formaPagamento","DINHEIRO","valorRecebido",30);
        for(int i=0;i<2;i++)mvc.perform(post("/vendas/"+venda+"/faturar").header(HttpHeaders.AUTHORIZATION,authorization).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(pagamento))).andExpect(status().isOk()).andExpect(jsonPath("$.itens[0].componentesConsumidos.length()").value(1));
        assertThat(movimentos.count()).isEqualTo(1);assertThat(pagamentos.count()).isEqualTo(1);
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("4");
    }
    @Test void historicoIncompletoBloqueiaCancelamentoSemReversaoParcial() throws Exception {
        long id=kit(2,1,"UN");var r=vender(pedidoKit(id,1)).andExpect(status().isCreated()).andReturn();
        long venda=json.readTree(r.getResponse().getContentAsString()).get("id").asLong();
        jdbc.update("delete from consumos_kit_venda");
        mvc.perform(post("/vendas/"+venda+"/cancelar").header(HttpHeaders.AUTHORIZATION,authorization)).andExpect(status().isConflict());
        assertThat(movimentos.count()).isEqualTo(1);assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("8");
        assertThat(vendas.findById(venda).orElseThrow().getStatus()).isEqualTo(br.com.novexa.erp.entity.StatusVenda.FATURADA);
    }
    @org.springframework.beans.factory.annotation.Autowired br.com.novexa.erp.repository.FornecedorRepository fornecedores;
    @Test void entradaEAjusteDevemUsarComponentesFisicos() throws Exception {
        long id=kit(1,1,"UN");
        mvc.perform(post("/estoque/movimentacoes/entrada").header(HttpHeaders.AUTHORIZATION,authorization).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(Map.of("produtoId",id,"quantidade",1)))).andExpect(status().isConflict());
        var f=new br.com.novexa.erp.entity.FornecedorEntity();f.setEmpresa(empresa);f.setRazaoSocial("Fornecedor sintético kit");fornecedores.saveAndFlush(f);
        mvc.perform(post("/estoque/entradas").header(HttpHeaders.AUTHORIZATION,authorization).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(Map.of("fornecedorId",f.getId(),"itens",List.of(Map.of("produtoId",id,"quantidade",1,"valorUnitario",5)),"chaveRequisicao",UUID.randomUUID()))))
                .andExpect(status().isConflict());
        assertThat(movimentos.count()).isZero();assertThat(jdbc.queryForObject("select count(*) from entradas_mercadoria",Long.class)).isZero();
    }
    @Test void composicaoAlteradaDuranteVendaExigeNovaConferencia() throws Exception {
        long id=kit(1,1,"UN");var p=pedidoKit(id,1);
        p.put("itens",List.of(Map.of("produtoId",id,"quantidade",1,"precoUnitarioEsperado",10,"composicaoVersaoEsperada",1)));
        mvc.perform(put("/produtos/"+id).header(HttpHeaders.AUTHORIZATION,authorization).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(dados(List.of(linha(produto.getId(),2,1,"UN")))))).andExpect(status().isOk());
        vender(p).andExpect(status().isConflict());assertThat(movimentos.count()).isZero();assertThat(pagamentos.count()).isZero();
    }
    @Test void doisComponentesFisicosTemConsumoEMovimentoIndividuais() throws Exception {
        var segundoProduto=new br.com.novexa.erp.entity.ProdutoEntity();segundoProduto.setEmpresa(empresa);segundoProduto.setNome("Componente KG");
        segundoProduto.setUnidadeMedida("KG");segundoProduto.setPrecoVenda(java.math.BigDecimal.ONE);segundoProduto.setEstoqueAtual(java.math.BigDecimal.ONE);segundoProduto.setPrecoCusto(new java.math.BigDecimal("4"));produtos.saveAndFlush(segundoProduto);
        var r=mvc.perform(post("/produtos").header(HttpHeaders.AUTHORIZATION,authorization).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(dados(List.of(linha(produto.getId(),2,1,"UN"),linha(segundoProduto.getId(),"0.125",1,"KG"))))))
                .andExpect(status().isCreated()).andReturn();long id=json.readTree(r.getResponse().getContentAsString()).get("id").asLong();
        vender(pedidoKit(id,2)).andExpect(status().isCreated()).andExpect(jsonPath("$.itens[0].componentesConsumidos.length()").value(2));
        assertThat(movimentos.count()).isEqualTo(2);assertThat(pagamentos.count()).isEqualTo(1);assertThat(movimentosCaixa.count()).isEqualTo(1);
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("6");
        assertThat(produtos.findById(segundoProduto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("0.75");
        mvc.perform(get("/produtos").header(HttpHeaders.AUTHORIZATION,authorization).param("sort","estoqueAtual,desc").param("size","1").param("page","1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(3)).andExpect(jsonPath("$.page").value(1));
    }
    @ParameterizedTest @ValueSource(strings={"","1","1,2,4"})
    void kitAPrazoEMistoMantemObrigacaoSemRecebimentoFicticio(String formas) throws Exception {
        long id=kit(2,1,"UN");var p=pedidoKit(id,1);p.remove("formaPagamento");p.remove("valorRecebido");
        var c=new br.com.novexa.erp.entity.ClienteEntity();c.setEmpresa(empresa);c.setNome("Cliente sintético kit");
        c.setTipoPessoa(br.com.novexa.erp.entity.TipoPessoa.FISICA);c.setAtivo(true);p.put("clienteId",clientes.saveAndFlush(c).getId());
        var ps=new ArrayList<Map<String,Object>>();
        if(!formas.isBlank())for(var f:formas.split(",")) {
            var config=configuracao(empresa,Long.parseLong(f),true);var pagamento=new HashMap<String,Object>();
            pagamento.put("configuracaoFormaPagamentoId",config.getId());pagamento.put("valor",2);
            if(f.equals("1"))pagamento.put("valorRecebido",2);ps.add(pagamento);
        }
        p.put("pagamentos",ps);p.put("parcelasPrazo",List.of(Map.of("valor",10-ps.size()*2,"vencimento",java.time.LocalDate.now().plusDays(30).toString())));
        var r=vender(p).andExpect(status().isCreated()).andExpect(jsonPath("$.contasReceber[0].valorRecebido").value(0)).andReturn();
        assertThat(pagamentos.count()).isEqualTo(ps.size());assertThat(movimentos.count()).isEqualTo(1);assertThat(movimentosCaixa.count()).isEqualTo(formas.contains("1")?1:0);
        assertThat(movimentosFinanceiros.count()).isZero();
        long venda=json.readTree(r.getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(post("/vendas/"+venda+"/cancelar").header(HttpHeaders.AUTHORIZATION,authorization)).andExpect(status().isOk());
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
    }
    @ParameterizedTest @ValueSource(strings={"PIX","CARTAO_DEBITO","CARTAO_CREDITO"})
    void kitPreservaDestinoFinanceiroSemReceitaDuplicada(String forma) throws Exception {
        long id=kit(2,1,"UN");var p=pedidoKit(id,1);p.put("formaPagamento",forma);
        if(forma.equals("PIX"))p.put("configuracaoFormaPagamentoId",configuracao(empresa,2,true).getId());
        vender(p).andExpect(status().isCreated());
        assertThat(pagamentos.count()).isEqualTo(1);assertThat(movimentosCaixa.count()).isZero();assertThat(movimentosFinanceiros.count()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from recebiveis",Long.class)).isEqualTo(forma.equals("PIX")?0:1);
        assertThat(jdbc.queryForObject("select count(*) from consumos_kit_venda",Long.class)).isEqualTo(1);
    }
    @Test void falhaFinanceiraDesfazIntegralmenteConsumoVendaESaldo() throws Exception {
        long id=kit(2,1,"UN");
        org.mockito.Mockito.doThrow(new IllegalStateException("falha controlada após estoque"))
                .when(movimentosCaixa).saveAndFlush(org.mockito.ArgumentMatchers.any());
        vender(pedidoKit(id,1)).andExpect(status().isInternalServerError());
        assertThat(movimentos.count()).isZero();assertThat(vendas.count()).isZero();assertThat(pagamentos.count()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from consumos_kit_venda",Long.class)).isZero();
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
    }
    @Test void rascunhoQuantidadeERemocaoNaoMovimentamEstoqueNemFinanceiro() throws Exception {
        long id=kit(2,1,"UN");
        var aberto=mvc.perform(post("/vendas/abertas").header(HttpHeaders.AUTHORIZATION,authorization)).andExpect(status().isCreated()).andReturn();
        long venda=json.readTree(aberto.getResponse().getContentAsString()).get("id").asLong();
        var item=mvc.perform(post("/vendas/"+venda+"/itens").header(HttpHeaders.AUTHORIZATION,authorization).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(Map.of("produtoId",id,"quantidade",1)))).andExpect(status().isOk()).andReturn();
        long itemId=json.readTree(item.getResponse().getContentAsString()).get("itens").get(0).get("id").asLong();
        mvc.perform(patch("/vendas/"+venda+"/itens/"+itemId).header(HttpHeaders.AUTHORIZATION,authorization).contentType(MediaType.APPLICATION_JSON).content("{\"quantidade\":3}")).andExpect(status().isOk());
        mvc.perform(delete("/vendas/"+venda+"/itens/"+itemId).header(HttpHeaders.AUTHORIZATION,authorization)).andExpect(status().isOk());
        assertThat(movimentos.count()).isZero();assertThat(pagamentos.count()).isZero();assertThat(movimentosCaixa.count()).isZero();
    }
    @Test void duplaFinalizacaoConcorrenteNaoDuplicaConsumo() throws Exception {
        long id=kit(2,1,"UN");var pedido=pedidoKit(id,2);var pool=java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            var a=pool.submit(()->vender(pedido).andReturn().getResponse().getStatus());
            var b=pool.submit(()->vender(pedido).andReturn().getResponse().getStatus());
            assertThat(a.get(20,java.util.concurrent.TimeUnit.SECONDS)).isEqualTo(201);assertThat(b.get(20,java.util.concurrent.TimeUnit.SECONDS)).isEqualTo(201);
            assertThat(vendas.count()).isEqualTo(1);assertThat(movimentos.count()).isEqualTo(1);assertThat(pagamentos.count()).isEqualTo(1);
            assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("6");
        } finally {pool.shutdownNow();}
    }
    @AfterEach void limparKit() {
        jdbc.update("delete from consumos_kit_venda");jdbc.update("delete from componentes_produto");
        jdbc.update("delete from fornecedores");
    }
    Map<String,Object> dados(List<Map<String,Object>> componentes) {
        return new HashMap<>(Map.of("nome","Kit teste","codigoInterno","KIT-TESTE","codigoBarras","7890000000012",
                "precoVenda",10,"unidadeMedida","UN","composto",true,"componentes",componentes));
    }
    Map<String,Object> linha(long id,Object quantidade,Object fator,String unidade) {
        return Map.of("produtoId",id,"quantidade",quantidade,"fator",fator,"unidade",unidade);
    }
    long kit(Object quantidade,Object fator,String unidade) throws Exception {
        var r=mvc.perform(post("/produtos").header(HttpHeaders.AUTHORIZATION,authorization).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(dados(List.of(linha(produto.getId(),quantidade,fator,unidade))))))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.composto").value(true)).andReturn();
        return json.readTree(r.getResponse().getContentAsString()).get("id").asLong();
    }
    Map<String,Object> pedidoKit(long id,int quantidade) {
        return new HashMap<>(Map.of("chaveRequisicao",UUID.randomUUID(),"itens",List.of(Map.of("produtoId",id,"quantidade",quantidade,"precoUnitarioEsperado",10)),
                "desconto",0,"totalEsperado",quantidade*10,"formaPagamento","DINHEIRO","valorRecebido",quantidade*10));
    }
    org.springframework.test.web.servlet.ResultActions vender(Map<String,Object> p) throws Exception {
        return mvc.perform(post("/vendas").header(HttpHeaders.AUTHORIZATION,authorization).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(p)));
    }
    @Test void consultaBuscaDisponibilidadeCustoEHistoricoSemEstoqueFisico() throws Exception {
        produto.setPrecoCusto(new java.math.BigDecimal("3.50"));produtos.saveAndFlush(produto);
        long id=kit(2,1,"UN");
        mvc.perform(get("/produtos/"+id).header(HttpHeaders.AUTHORIZATION,authorization)).andExpect(status().isOk())
                .andExpect(jsonPath("$.estoqueAtual").value(5)).andExpect(jsonPath("$.precoCusto").value(7));
        for(String busca:List.of("Kit teste","KIT-TESTE","7890000000012"))
            mvc.perform(get("/produtos/buscar").param("termo",busca).header(HttpHeaders.AUTHORIZATION,authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(id));
        mvc.perform(get("/produtos/"+id+"/composicoes").header(HttpHeaders.AUTHORIZATION,authorization)).andExpect(jsonPath("$[0].versao").value(1));
        assertThat(produtos.findById(id).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("0");assertThat(movimentos.count()).isZero();
    }
    @Test void finalizaUmaVezConsomeComponentesECancelaComComposicaoHistorica() throws Exception {
        long id=kit(2,1,"UN");var p=pedidoKit(id,3);
        var r=vender(p).andExpect(status().isCreated()).andExpect(jsonPath("$.itens[0].componentesConsumidos[0].quantidade").value(6)).andReturn();
        long venda=json.readTree(r.getResponse().getContentAsString()).get("id").asLong();
        vender(p).andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(venda));
        assertThat(pagamentos.count()).isEqualTo(1);assertThat(movimentosCaixa.count()).isEqualTo(1);assertThat(movimentosFinanceiros.count()).isZero();
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("4");
        mvc.perform(put("/produtos/"+id).header(HttpHeaders.AUTHORIZATION,authorization).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(dados(List.of(linha(produto.getId(),1,1,"UN")))))).andExpect(status().isOk());
        mvc.perform(post("/vendas/"+venda+"/cancelar").header(HttpHeaders.AUTHORIZATION,authorization)).andExpect(status().isOk());
        mvc.perform(post("/vendas/"+venda+"/cancelar").header(HttpHeaders.AUTHORIZATION,authorization)).andExpect(status().isOk());
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
        assertThat(movimentos.count()).isEqualTo(2);assertThat(jdbc.queryForObject("select count(*) from consumos_kit_venda where reversao_id is not null",Long.class)).isEqualTo(1);
        mvc.perform(get("/estoque/movimentacoes/produto/"+produto.getId()).header(HttpHeaders.AUTHORIZATION,authorization))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].vendaId").value(venda)).andExpect(jsonPath("$.items[1].produtoCompostoId").value(id));
        mvc.perform(get("/produtos/"+id+"/composicoes").header(HttpHeaders.AUTHORIZATION,authorization)).andExpect(jsonPath("$.length()").value(2));
    }
    @Test void conversaoEAgregacaoComProdutoAvulsoNaoPermitemBaixaParcial() throws Exception {
        long id=kit(1,6,"CX");var p=pedidoKit(id,1);
        p.put("itens",List.of(Map.of("produtoId",id,"quantidade",1,"precoUnitarioEsperado",10),Map.of("produtoId",produto.getId(),"quantidade",5,"precoUnitarioEsperado",10)));
        p.put("totalEsperado",60);p.put("valorRecebido",60);
        vender(p).andExpect(status().isConflict()).andExpect(jsonPath("$.codigo").value("ESTOQUE_INSUFICIENTE"));
        assertThat(movimentos.count()).isZero();assertThat(pagamentos.count()).isZero();assertThat(vendas.count()).isZero();
        empresa.setPermitirVendaEstoqueNegativo(true);empresas.saveAndFlush(empresa);
        vender(p).andExpect(status().isConflict());p.put("confirmarEstoqueInsuficiente",true);vender(p).andExpect(status().isCreated());
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("-1");
    }
    @ParameterizedTest @ValueSource(strings={"zero","negativo","duplicado","outraEmpresa","ciclo","vazio","precisao","fator"})
    void composicaoInvalidaRejeitadaSemEfeitos(String caso) throws Exception {
        long id=produto.getId();List<Map<String,Object>> linhas=new ArrayList<>(List.of(linha(id,1,1,"UN")));
        switch(caso) {
            case "zero" -> linhas=List.of(linha(id,0,1,"UN"));case "negativo" -> linhas=List.of(linha(id,-1,1,"UN"));
            case "duplicado" -> linhas.add(linha(id,2,1,"UN"));case "vazio" -> linhas=List.of();
            case "outraEmpresa" -> {produto.setEmpresa(outra);produtos.saveAndFlush(produto);}
            case "ciclo" -> linhas=List.of(linha(kit(1,1,"UN"),1,1,"UN"));
            case "precisao" -> linhas=List.of(linha(id,"0.001","0.000001","CX"));case "fator" -> linhas=List.of(linha(id,1,2,"UN"));
        }
        mvc.perform(post("/produtos").header(HttpHeaders.AUTHORIZATION,authorization).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dados(linhas))))
                .andExpect(status().is4xxClientError());assertThat(movimentos.count()).isZero();
    }
}
