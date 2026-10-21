package br.com.novexa.erp.controller;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.AutowireCapableBeanFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.context.jdbc.Sql;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:politicas;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.username=sa","spring.datasource.password=","spring.datasource.driver-class-name=org.h2.Driver",
    "spring.jpa.hibernate.ddl-auto=create-drop","spring.flyway.enabled=false","spring.jpa.open-in-view=false","spring.jpa.show-sql=false",
    "novexa.jwt.secret=01234567890123456789012345678901","novexa.jwt.expiration-ms=60000"})
@AutoConfigureMockMvc
@Sql(statements={"DELETE FROM formas_pagamento","INSERT INTO formas_pagamento(id,descricao,tipo,ativo) VALUES (1,'Dinheiro','DINHEIRO',true),(2,'PIX','PIX',true),(3,'Debito','DEBITO',true),(4,'Credito','CREDITO',true)"})
class PoliticasRecebimentoHttpTest {
    @Autowired AutowireCapableBeanFactory beans;
    @MockitoSpyBean PagamentoRepository pagamentos;
    @MockitoSpyBean MovimentacaoFinanceiraRepository movimentosFinanceiros;
    @MockitoSpyBean MovimentacaoCaixaRepository movimentosCaixa;
    @MockitoSpyBean ContaFinanceiraRepository contas;
    @Autowired RecebivelRepository recebiveis;
    VendaHttpTest f;
    @BeforeEach void preparar() { f=new VendaHttpTest(); beans.autowireBean(f); f.pagamentos=pagamentos; f.movimentosFinanceiros=movimentosFinanceiros; f.movimentosCaixa=movimentosCaixa; f.preparar(); }
    @AfterEach void limpar() { reset(contas); if(f!=null) { f.jdbc.update("delete from conferencias_fechamento_caixa"); f.limpar(); } }
    org.springframework.test.web.servlet.ResultActions politica(String modo,String conferencia,boolean exigir) throws Exception {
        return f.mvc.perform(put("/financeiro/configuracoes/recebimentos").header("Authorization",f.authorization).contentType("application/json")
            .content(f.json.writeValueAsBytes(Map.of("modo",modo,"conferencia",conferencia,"exigirValoresInformadosNoFechamento",exigir))));
    }
    void simplificado() throws Exception { politica("SIMPLIFICADO","POR_FORMA_PAGAMENTO",true).andExpect(status().isOk()); }
    Map<String,Object> pedido(List<Map<String,Object>> partes,int total) {
        return new HashMap<>(Map.of("chaveRequisicao",UUID.randomUUID(),"itens",List.of(Map.of("produtoId",f.produto.getId(),"quantidade",2,"precoUnitarioEsperado",total/2)),
            "desconto",0,"totalEsperado",total,"pagamentos",partes));
    }
    org.springframework.test.web.servlet.ResultActions enviar(Map<String,Object> p) throws Exception { return f.mvc.perform(post("/vendas").header("Authorization",f.authorization).contentType("application/json").content(f.json.writeValueAsBytes(p))); }
    long venda(Map<String,Object> p) throws Exception { return f.json.readTree(enviar(p).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong(); }
    Map<String,Object> parte(ConfiguracaoFormaPagamentoEmpresaEntity c,int valor) { return Map.of("configuracaoFormaPagamentoId",c.getId(),"valor",valor); }
    BigDecimal saldo(ConfiguracaoFormaPagamentoEmpresaEntity c) { return contas.findById(c.getContaFinanceiraDestino().getId()).orElseThrow().getSaldoAtual(); }
    org.springframework.test.web.servlet.ResultActions lote(List<Long> ids) throws Exception { return f.mvc.perform(post("/financeiro/recebiveis/liquidar-lote").header("Authorization",f.authorization).contentType("application/json").content(f.json.writeValueAsBytes(Map.of("recebivelIds",ids)))); }
    @Test void defaultsTrocasNaoReinterpretamHistorico() throws Exception {
        f.mvc.perform(get("/financeiro/configuracoes/recebimentos").header("Authorization",f.authorization)).andExpect(status().isOk()).andExpect(jsonPath("$.modo").value("CONTROLADO"));
        var c=f.configuracao(f.empresa,2,true); var p=pedido(List.of(parte(c,20)),20); venda(p);
        assertThat(movimentosFinanceiros.count()).isZero(); simplificado(); assertThat(movimentosFinanceiros.count()).isZero();
        assertThat(pagamentos.findAll().getFirst().getModoRecebimentoSnapshot()).isEqualTo(ModoRecebimentoFinanceiro.CONTROLADO);
        politica("CONTROLADO","TOTAL",false).andExpect(status().isOk()); assertThat(saldo(c)).isEqualByComparingTo("100");
    }
    @ParameterizedTest @ValueSource(strings={"ADMIN","GERENTE","OPERADOR","USUARIO"})
    void permissoesConfiguracaoEConfirmacaoManual(String perfil) throws Exception {
        f.operador.setPerfil(PerfilUsuario.valueOf(perfil)); f.usuarios.saveAndFlush(f.operador); f.authorization="Bearer "+f.jwt.gerarToken(f.operador);
        politica("SIMPLIFICADO","TOTAL",true).andExpect(status().is(perfil.equals("ADMIN")||perfil.equals("GERENTE")?200:403));
        var c=f.configuracao(f.empresa,2,true); venda(pedido(List.of(parte(c,20)),20));
        f.mvc.perform(post("/financeiro/pagamentos/"+pagamentos.findAll().getFirst().getId()+"/confirmar-recebimento").header("Authorization",f.authorization))
            .andExpect(status().is(perfil.equals("ADMIN")||perfil.equals("GERENTE")?200:403));
    }
    @Test void configuracaoInvalidaETenant() throws Exception {
        politica("INVALIDO","TOTAL",true).andExpect(status().isBadRequest());
        simplificado(); assertThat(f.empresas.findById(f.outra.getId()).orElseThrow().getModoRecebimentoFinanceiro()).isEqualTo(ModoRecebimentoFinanceiro.CONTROLADO);
    }
    @ParameterizedTest @ValueSource(booleans={false,true})
    void mistoCompletoMantemCadaDestinoSemDuplicidade(boolean simples) throws Exception {
        if(simples) simplificado();
        var dinheiro=f.configuracao(f.empresa,1,true); var nubank=f.configuracao(f.empresa,2,true); var sicredi=f.configuracao(f.empresa,2,true); var debito=f.configuracao(f.empresa,3,true);
        f.produto.setPrecoVenda(new BigDecimal("75")); f.produtos.saveAndFlush(f.produto);
        var p=pedido(List.of(parte(dinheiro,20),parte(nubank,30),parte(sicredi,10),parte(debito,40)),150);
        var cliente=new ClienteEntity(); cliente.setEmpresa(f.empresa);cliente.setNome("Cliente de teste");cliente.setTipoPessoa(TipoPessoa.FISICA);cliente.setAtivo(true);
        cliente=f.clientes.saveAndFlush(cliente);p.put("clienteId",cliente.getId());p.put("parcelasPrazo",List.of(Map.of("valor",50,"vencimento",LocalDate.now().plusDays(30).toString())));
        long id=venda(p); assertThat(venda(p)).isEqualTo(id);
        assertThat(pagamentos.count()).isEqualTo(4);assertThat(recebiveis.count()).isEqualTo(1);
        assertThat(f.jdbc.queryForObject("select count(*) from contas_receber",Long.class)).isEqualTo(1);
        assertThat(saldo(nubank)).isEqualByComparingTo(simples?"130":"100");assertThat(saldo(sicredi)).isEqualByComparingTo(simples?"110":"100");assertThat(saldo(debito)).isEqualByComparingTo("100");
        assertThat(movimentosFinanceiros.count()).isEqualTo(simples?2:0);
        assertThat(movimentosCaixa.findAll()).singleElement().satisfies(m -> assertThat(m.getValor()).isEqualByComparingTo("20"));
        assertThat(recebiveis.findAll().getFirst().getStatus()).isEqualTo(StatusRecebivel.PENDENTE);
        if(simples) { f.mvc.perform(post("/vendas/"+id+"/cancelar").header("Authorization",f.authorization)).andExpect(status().isOk());
            f.mvc.perform(post("/vendas/"+id+"/cancelar").header("Authorization",f.authorization)).andExpect(status().isOk());
            assertThat(saldo(nubank)).isEqualByComparingTo("100");assertThat(movimentosFinanceiros.findAll()).allMatch(MovimentacaoFinanceiraEntity::isEstornada); }
    }
    @Test void falhaPosteriorAoCreditoPixReverteVendaEstoqueESaldo() throws Exception {
        simplificado();var c=f.configuracao(f.empresa,2,true);
        doAnswer(i -> { var m=movimentosFinanceiros.save((MovimentacaoFinanceiraEntity)i.getArgument(0));movimentosFinanceiros.flush();throw new IllegalStateException("falha após crédito PIX"); })
            .when(movimentosFinanceiros).saveAndFlush(any(MovimentacaoFinanceiraEntity.class));
        enviar(pedido(List.of(parte(c,20)),20)).andExpect(status().isInternalServerError());
        assertThat(f.vendas.count()).isZero();assertThat(pagamentos.count()).isZero();assertThat(movimentosFinanceiros.count()).isZero();assertThat(saldo(c)).isEqualByComparingTo("100");
        assertThat(f.produtos.findById(f.produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
    }
    @Test void contaInativadaSobLockRejeitaSemEfeito() throws Exception {
        simplificado();var c=f.configuracao(f.empresa,2,true); var a=contas.findById(c.getContaFinanceiraDestino().getId()).orElseThrow();a.situacao(false);contas.saveAndFlush(a);
        enviar(pedido(List.of(parte(c,20)),20)).andExpect(status().isConflict());assertThat(movimentosFinanceiros.count()).isZero();assertThat(f.vendas.count()).isZero();
    }
    @Test void loteUsaSnapshotERetryECancelamentoIndividual() throws Exception {
        simplificado();var c=f.configuracao(f.empresa,4,true);
        long a=venda(pedido(List.of(parte(c,20)),20));long b=venda(pedido(List.of(parte(c,20)),20));
        var ids=recebiveis.findAll().stream().map(RecebivelEntity::getId).toList();
        assertThat(saldo(c)).isEqualByComparingTo("100");lote(ids).andExpect(status().isOk());lote(ids.reversed()).andExpect(status().isOk());
        assertThat(saldo(c)).isEqualByComparingTo("140");assertThat(movimentosFinanceiros.count()).isEqualTo(2);
        f.mvc.perform(post("/vendas/"+a+"/cancelar").header("Authorization",f.authorization)).andExpect(status().isOk());
        assertThat(saldo(c)).isEqualByComparingTo("120");assertThat(f.vendas.findById(b).orElseThrow().getStatus()).isEqualTo(StatusVenda.FATURADA);
        lote(ids).andExpect(status().isConflict());assertThat(saldo(c)).isEqualByComparingTo("120");
    }
    @Test void falhaNoSegundoItemDoLoteRevertePrimeiro() throws Exception {
        simplificado();var c=f.configuracao(f.empresa,4,true);venda(pedido(List.of(parte(c,20)),20));venda(pedido(List.of(parte(c,20)),20));
        var ids=recebiveis.findAll().stream().map(RecebivelEntity::getId).toList();var vezes=new java.util.concurrent.atomic.AtomicInteger();
        doAnswer(i -> { var conta=(ContaFinanceiraEntity)i.getArgument(0);contas.save(conta);contas.flush();if(vezes.incrementAndGet()==2)throw new IllegalStateException("falha no segundo crédito");return conta; })
            .when(contas).saveAndFlush(any(ContaFinanceiraEntity.class));
        lote(ids).andExpect(status().isInternalServerError());assertThat(saldo(c)).isEqualByComparingTo("100");assertThat(movimentosFinanceiros.count()).isZero();
        assertThat(recebiveis.findAll()).allMatch(r -> r.getStatus()==StatusRecebivel.PENDENTE);
    }
    @Test void loteRejeitaIdsRepetidosOutroTenantEOperador() throws Exception {
        simplificado();var c=f.configuracao(f.empresa,4,true);venda(pedido(List.of(parte(c,20)),20));long id=recebiveis.findAll().getFirst().getId();
        lote(List.of(id,id)).andExpect(status().isBadRequest());lote(List.of(id,Long.MAX_VALUE)).andExpect(status().isNotFound());assertThat(movimentosFinanceiros.count()).isZero();
        f.operador.setPerfil(PerfilUsuario.OPERADOR);f.usuarios.saveAndFlush(f.operador);f.authorization="Bearer "+f.jwt.gerarToken(f.operador);lote(List.of(id)).andExpect(status().isForbidden());
    }
    @Test void agendaAgrupaSnapshotsPaginacaoEListaIds() throws Exception {
        simplificado();var a=f.configuracao(f.empresa,4,true);var b=f.configuracao(f.empresa,4,true);
        venda(pedido(List.of(parte(a,20)),20));venda(pedido(List.of(parte(a,20)),20));venda(pedido(List.of(parte(b,20)),20));
        f.mvc.perform(get("/financeiro/recebiveis/agenda?size=1").header("Authorization",f.authorization)).andExpect(status().isOk())
            .andExpect(jsonPath("$.totalItems").value(2)).andExpect(jsonPath("$.items[0].quantidade").value(2)).andExpect(jsonPath("$.items[0].liquido").value(40));
        f.mvc.perform(get("/financeiro/recebiveis/agenda/itens").param("data",LocalDate.now().toString()).param("configuracaoId",a.getId().toString()).param("tipo","CREDITO")
            .param("contaDestinoId",a.getContaFinanceiraDestino().getId().toString()).header("Authorization",f.authorization)).andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(2));
    }
    @ParameterizedTest @ValueSource(strings={"POR_FORMA_PAGAMENTO","TOTAL"})
    void conferenciaAuditaSemLiquidarNemAlterarSaldos(String modo) throws Exception {
        simplificado();var a=f.configuracao(f.empresa,2,true);var b=f.configuracao(f.empresa,2,true);var cartao=f.configuracao(f.empresa,4,true);
        venda(pedido(List.of(parte(a,5),parte(b,5),parte(cartao,10)),20));politica("SIMPLIFICADO",modo,true).andExpect(status().isOk());
        var sessao=f.sessoes.findAll().getFirst();String url="/financeiro/caixas/"+sessao.getCaixa().getId()+"/sessoes/"+sessao.getId()+"/fechar";
        Object meios=modo.equals("TOTAL")?List.of():List.of(Map.of("configuracaoId",a.getId(),"valorInformado",4),Map.of("configuracaoId",b.getId(),"valorInformado",6),Map.of("configuracaoId",cartao.getId(),"valorInformado",10));
        var conferencia=new HashMap<String,Object>(Map.of("modo",modo,"meios",meios,"observacao","Conferência de teste"));if(modo.equals("TOTAL"))conferencia.put("totalInformado",19);
        var p=Map.of("saldoFinal",0,"conferenciaMeios",conferencia);
        for(int i=0;i<2;i++)f.mvc.perform(post(url).header("Authorization",f.authorization).contentType("application/json").content(f.json.writeValueAsBytes(p))).andExpect(status().isOk());
        assertThat(saldo(a)).isEqualByComparingTo("105");assertThat(saldo(b)).isEqualByComparingTo("105");assertThat(saldo(cartao)).isEqualByComparingTo("100");
        assertThat(movimentosFinanceiros.count()).isEqualTo(2);assertThat(recebiveis.findAll().getFirst().getStatus()).isEqualTo(StatusRecebivel.PENDENTE);
        assertThat(f.jdbc.queryForObject("select count(*) from conferencias_fechamento_caixa",Long.class)).isEqualTo(modo.equals("TOTAL")?2:4);
        assertThat(f.jdbc.queryForObject("select count(*) from conferencias_fechamento_caixa where valor_informado<>valor_esperado",Long.class)).isEqualTo(modo.equals("TOTAL")?1:2);
    }
    @Test void conferenciaOpcionalMantemNaoInformadoSemInventarZero() throws Exception {
        var c=f.configuracao(f.empresa,4,true);venda(pedido(List.of(parte(c,20)),20));politica("CONTROLADO","TOTAL",false).andExpect(status().isOk());var s=f.sessoes.findAll().getFirst();
        f.mvc.perform(post("/financeiro/caixas/"+s.getCaixa().getId()+"/sessoes/"+s.getId()+"/fechar").header("Authorization",f.authorization).contentType("application/json")
            .content(f.json.writeValueAsBytes(Map.of("saldoFinal",0,"conferenciaMeios",Map.of("modo","TOTAL","meios",List.of()))))).andExpect(status().isOk());
        assertThat(f.jdbc.queryForObject("select count(*) from conferencias_fechamento_caixa where escopo='TOTAL_MEIOS' and valor_informado is null",Long.class)).isEqualTo(1);
    }

    @Test void operadorRegistraPixSomentePeloFaturamentoSimplificado() throws Exception {
        simplificado();f.operador.setPerfil(PerfilUsuario.OPERADOR);f.usuarios.saveAndFlush(f.operador);f.authorization="Bearer "+f.jwt.gerarToken(f.operador);
        var c=f.configuracao(f.empresa,2,true);venda(pedido(List.of(parte(c,20)),20));assertThat(saldo(c)).isEqualByComparingTo("120");
        f.mvc.perform(post("/financeiro/pagamentos/"+pagamentos.findAll().getFirst().getId()+"/confirmar-recebimento").header("Authorization",f.authorization)).andExpect(status().isForbidden());
        assertThat(movimentosFinanceiros.count()).isEqualTo(1);
    }
    @Test void mudancaDePoliticaNaoRevertePixRegistradoENaoConfirmaPendente() throws Exception {
        simplificado();var c=f.configuracao(f.empresa,2,true);venda(pedido(List.of(parte(c,20)),20));politica("CONTROLADO","TOTAL",true).andExpect(status().isOk());
        venda(pedido(List.of(parte(c,20)),20));assertThat(saldo(c)).isEqualByComparingTo("120");assertThat(movimentosFinanceiros.count()).isEqualTo(1);
        simplificado();assertThat(saldo(c)).isEqualByComparingTo("120");assertThat(movimentosFinanceiros.count()).isEqualTo(1);
    }
    @ParameterizedTest @ValueSource(strings={"POR_FORMA_PAGAMENTO","TOTAL"})
    void conferenciaExigeValoresEObservacaoSemCriarEfeitos(String modo) throws Exception {
        var c=f.configuracao(f.empresa,4,true);venda(pedido(List.of(parte(c,20)),20));politica("CONTROLADO",modo,true).andExpect(status().isOk());var sessao=f.sessoes.findAll().getFirst();
        String url="/financeiro/caixas/"+sessao.getCaixa().getId()+"/sessoes/"+sessao.getId()+"/fechar";
        var conferencia=new HashMap<String,Object>(Map.of("modo",modo,"meios",List.of()));var p=Map.of("saldoFinal",0,"conferenciaMeios",conferencia);
        f.mvc.perform(post(url).header("Authorization",f.authorization).contentType("application/json").content(f.json.writeValueAsBytes(p))).andExpect(status().isBadRequest());
        if(modo.equals("TOTAL"))conferencia.put("totalInformado",19);else conferencia.put("meios",List.of(Map.of("configuracaoId",c.getId(),"valorInformado",19)));
        f.mvc.perform(post(url).header("Authorization",f.authorization).contentType("application/json").content(f.json.writeValueAsBytes(p))).andExpect(status().isConflict());
        assertThat(f.sessoes.findById(sessao.getId()).orElseThrow().getStatus()).isEqualTo(StatusSessaoCaixa.ABERTO);assertThat(movimentosFinanceiros.count()).isZero();
    }
    @Test void loteComTaxasEDestinoHistoricoNaoUsaCadastroAtual() throws Exception {
        simplificado();var c=f.configuracao(f.empresa,4,true);
        f.mvc.perform(put("/financeiro/configuracoes-formas-pagamento/"+c.getId()).header("Authorization",f.authorization).contentType("application/json")
                .content(f.json.writeValueAsBytes(Map.of("formaPagamentoId",4,"nomeExibicao",c.getNomeExibicao(),"ativo",true,"contaFinanceiraDestinoId",c.getContaFinanceiraDestino().getId(),"taxaPercentual",3,"taxaFixa",0.50,"prazoRecebimentoDias",30)))).andExpect(status().isOk());
        venda(pedido(List.of(parte(c,20)),20));venda(pedido(List.of(parte(c,20)),20));
        var outro=f.contasFinanceiras.saveAndFlush(new ContaFinanceiraEntity(f.empresa,"Novo destino",TipoContaFinanceira.BANCO,BigDecimal.ZERO));
        f.mvc.perform(put("/financeiro/configuracoes-formas-pagamento/"+c.getId()).header("Authorization",f.authorization).contentType("application/json")
                .content(f.json.writeValueAsBytes(Map.of("formaPagamentoId",4,"nomeExibicao","Novo nome","ativo",true,"contaFinanceiraDestinoId",outro.getId(),"taxaPercentual",5,"taxaFixa",0,"prazoRecebimentoDias",1)))).andExpect(status().isOk());
        lote(recebiveis.findAll().stream().map(RecebivelEntity::getId).toList()).andExpect(status().isOk());
        assertThat(saldo(c)).isEqualByComparingTo("137.80");assertThat(contas.findById(outro.getId()).orElseThrow().getSaldoAtual()).isZero();
        assertThat(recebiveis.findAll()).allSatisfy(r -> {assertThat(r.getValorLiquidoRecebido()).isEqualByComparingTo("18.90");assertThat(r.getDataPrevistaRecebimento()).isEqualTo(r.getDataVenda().toLocalDate().plusDays(30));});
    }

    @Test void agendaLegadaSemDestinoEConsultaVaziaPreservamTenant() throws Exception {
        f.mvc.perform(get("/financeiro/recebiveis/agenda").header("Authorization",f.authorization)).andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(0));
        var p=pedido(List.of(),20);p.remove("pagamentos");p.put("formaPagamento","CARTAO_CREDITO");p.put("valorRecebido",20);venda(p);
        f.mvc.perform(get("/financeiro/recebiveis/agenda").header("Authorization",f.authorization)).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].contaDestinoId").doesNotExist());
        f.mvc.perform(get("/financeiro/recebiveis/agenda/itens").param("tipo","CREDITO").param("data",LocalDate.now().toString()).header("Authorization",f.authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1));
        long id=recebiveis.findAll().getFirst().getId();
        f.segundo.setEmpresa(f.outra);f.segundo.setPerfil(PerfilUsuario.ADMIN);f.usuarios.saveAndFlush(f.segundo);f.authorization="Bearer "+f.jwt.gerarToken(f.segundo);
        f.mvc.perform(get("/financeiro/recebiveis/agenda").header("Authorization",f.authorization)).andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(0));
        politica("SIMPLIFICADO","TOTAL",false).andExpect(status().isOk());lote(List.of(id)).andExpect(status().isNotFound());
        assertThat(movimentosFinanceiros.count()).isZero();
    }
    void concorrentes(boolean pix) throws Exception {
        simplificado();var c=f.configuracao(f.empresa,pix?2:4,true);var p=pedido(List.of(parte(c,20)),20);
        List<Long> ids;
        if(pix)ids=List.of();else{venda(p);venda(pedido(List.of(parte(c,20)),20));ids=recebiveis.findAll().stream().map(RecebivelEntity::getId).toList();}
        var pool=Executors.newFixedThreadPool(2);var start=new CountDownLatch(1);
        try {var a=pool.submit(() -> {start.await();return pix?enviar(p).andReturn().getResponse().getStatus():lote(ids).andReturn().getResponse().getStatus();});
            var b=pool.submit(() -> {start.await();return pix?enviar(p).andReturn().getResponse().getStatus():lote(ids.reversed()).andReturn().getResponse().getStatus();});
            start.countDown();assertThat(a.get(20,TimeUnit.SECONDS)).isEqualTo(pix?201:200);assertThat(b.get(20,TimeUnit.SECONDS)).isEqualTo(pix?201:200);
        }finally{start.countDown();pool.shutdownNow();pool.awaitTermination(5,TimeUnit.SECONDS);}
        assertThat(saldo(c)).isEqualByComparingTo(pix?"120":"140");assertThat(movimentosFinanceiros.count()).isEqualTo(pix?1:2);
    }
}
