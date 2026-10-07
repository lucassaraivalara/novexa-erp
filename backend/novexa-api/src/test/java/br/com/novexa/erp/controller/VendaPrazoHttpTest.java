package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.ContaReceberRepository;
import br.com.novexa.erp.service.ContaFinanceiraService;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class VendaPrazoHttpTest extends VendaHttpTest {
    @MockitoSpyBean ContaReceberRepository contasReceber;
    @MockitoSpyBean ContaFinanceiraService financeiroService;

    @AfterEach void limparSpiesPrazo() { reset(contasReceber, financeiroService); }

    @ParameterizedTest @ValueSource(strings = {"", "1", "2", "3", "4", "1,2,4"})
    void prazoProcessaMistoSemPagamentoOuMovimentoParaDivida(String formas) throws Exception {
        var p = pedidoPrazo(formas);
        var venda = enviarPrazo(p, 201);
        long id = venda.get("id").asLong();
        assertThat(enviarPrazo(p, 201).get("id").asLong()).isEqualTo(id);
        int imediatos = formas.isEmpty() ? 0 : formas.split(",").length;
        assertThat(pagamentos.count()).isEqualTo(imediatos);
        assertThat(jdbc.queryForObject("select count(*) from recebiveis", Integer.class)).isEqualTo(formas.contains("3") || formas.contains("4") ? 1 : 0);
        assertThat(contasReceber.count()).isEqualTo(2);
        assertThat(venda.get("status").asText()).isEqualTo("FATURADA");
        assertThat(venda.get("troco").decimalValue()).isEqualByComparingTo(formas.contains("1") ? "1" : "0");
        assertThat(venda.get("valorRecebido").decimalValue()).isEqualByComparingTo(String.valueOf(imediatos * 2 + (formas.contains("1") ? 1 : 0)));
        assertThat(venda.get("valorPrazo").decimalValue()).isEqualByComparingTo(String.valueOf(20 - imediatos * 2));
        assertThat(movimentosFinanceiros.count()).isZero();
        assertThat(movimentos.count()).isEqualTo(1);
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("8");
        var parcelas = venda.get("contasReceber");
        assertThat(parcelas.size()).isEqualTo(2);
        for (int i = 0; i < 2; i++) {
            var c = parcelas.get(i);
            assertThat(c.get("numeroParcela").asInt()).isEqualTo(i + 1);
            assertThat(c.get("totalParcelas").asInt()).isEqualTo(2);
            assertThat(c.get("vendaId").asLong()).isEqualTo(id);
            assertThat(c.get("origem").asText()).isEqualTo("VENDA_A_PRAZO");
            assertThat(c.get("status").asText()).isEqualTo("PENDENTE");
            assertThat(c.get("valorRecebido").decimalValue()).isZero();
            assertThat(c.get("dataVencimento").asText()).isEqualTo(LocalDate.now().plusDays(30L * (i + 1)).toString());
        }
        if (formas.contains("1")) assertThat(jdbc.queryForObject("select valor from movimentacoes_caixa where tipo='VENDA'", BigDecimal.class)).isEqualByComparingTo("2");
        mvc.perform(get("/vendas/" + id).header("Authorization", authorization)).andExpect(jsonPath("$.contasReceber.length()").value(2));
    }

    @ParameterizedTest @ValueSource(strings = {"cliente", "clienteOutroTenant", "clienteInativo", "zero", "negativo", "vencimento", "menor", "maior"})
    void prazoValidacoesSemEfeitos(String caso) throws Exception {
        var p = pedidoPrazo("");
        var parcela = new HashMap<String, Object>(Map.of("valor", 20, "vencimento", LocalDate.now().plusDays(1).toString()));
        p.put("parcelasPrazo", List.of(parcela));
        switch (caso) {
            case "cliente" -> p.remove("clienteId");
            case "clienteOutroTenant" -> p.put("clienteId", clientePrazo(outra).getId());
            case "clienteInativo" -> { var c = clientes.findById((Long)p.get("clienteId")).orElseThrow(); c.setAtivo(false); clientes.saveAndFlush(c); }
            case "zero" -> parcela.put("valor", 0);
            case "negativo" -> parcela.put("valor", -1);
            case "vencimento" -> parcela.remove("vencimento");
            case "menor" -> parcela.put("valor", 19);
            case "maior" -> parcela.put("valor", 21);
        }
        enviarPrazo(p, List.of("zero", "negativo", "vencimento").contains(caso) ? 400 : 409);
        assertThat(vendas.count()).isZero(); assertThat(contasReceber.count()).isZero();
        assertThat(pagamentos.count()).isZero(); assertThat(movimentos.count()).isZero(); assertThat(movimentosFinanceiros.count()).isZero();
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
    }

    @Test void prazoFaturaVendaAbertaComIdempotencia() throws Exception {
        var p = pedidoPrazo("");
        long id = json.readTree(mvc.perform(post("/vendas/abertas").header("Authorization", authorization))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(post("/vendas/" + id + "/itens").header("Authorization", authorization).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("produtoId", produto.getId(), "quantidade", 2)))).andExpect(status().isOk());
        mvc.perform(put("/vendas/" + id + "/cliente").header("Authorization", authorization).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("clienteId", p.get("clienteId"))))).andExpect(status().isOk());
        for (int i = 0; i < 2; i++) mvc.perform(post("/vendas/" + id + "/faturar").header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(p))).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("FATURADA"));
        assertThat(contasReceber.count()).isEqualTo(2); assertThat(movimentos.count()).isEqualTo(1); assertThat(pagamentos.count()).isZero();
    }

    @Test void prazoRollbackQuandoSegundaParcelaFalha() throws Exception {
        var p = pedidoPrazo("1");
        doThrow(new IllegalStateException("falha controlada na segunda parcela"))
                .when(contasReceber).saveAndFlush(argThat(c -> c.getNumeroParcela() == 2));
        enviarPrazo(p, 500);
        assertThat(vendas.count()).isZero(); assertThat(contasReceber.count()).isZero(); assertThat(pagamentos.count()).isZero();
        assertThat(movimentosCaixa.count()).isZero(); assertThat(movimentos.count()).isZero();
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
    }

    @ParameterizedTest @ValueSource(strings = {"", "1,2,4"})
    void prazoCancelaTodasParcelasPendentesEPreservaHistorico(String formas) throws Exception {
        long id = enviarPrazo(pedidoPrazo(formas), 201).get("id").asLong();
        cancelarPrazo(id, 200); cancelarPrazo(id, 200);
        assertThat(contasReceber.findAll()).hasSize(2).allSatisfy(c -> assertThat(c.getStatus()).isEqualTo(StatusContaReceber.CANCELADA));
        assertThat(pagamentos.findAll()).allSatisfy(p -> assertThat(p.getStatus()).isEqualTo(StatusPagamento.CANCELADO));
        assertThat(movimentosFinanceiros.count()).isZero(); assertThat(movimentos.count()).isEqualTo(2);
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
    }

    @Test void prazoCancelaMistoComPixCartaoLiquidadoEMultiplasBaixas() throws Exception {
        var v = enviarPrazo(pedidoPrazo("1,2,4"), 201); long id = v.get("id").asLong();
        var regs = pagamentos.findByEmpresaIdAndVendaIdOrderBySequenciaAsc(empresa.getId(), id);
        long pix = regs.stream().filter(p -> p.getFormaPagamento() == FormaPagamento.PIX).findFirst().orElseThrow().getId();
        mvc.perform(post("/financeiro/pagamentos/" + pix + "/confirmar-recebimento").header("Authorization", authorization)).andExpect(status().isOk());
        long recebivel = jdbc.queryForObject("select id from recebiveis", Long.class);
        mvc.perform(post("/financeiro/recebiveis/" + recebivel + "/liquidar").header("Authorization", authorization)).andExpect(status().isOk());
        var destino = contasFinanceiras.findAll().getFirst();
        var saldos = new HashMap<Long, BigDecimal>();
        contasFinanceiras.findAll().forEach(c -> saldos.put(c.getId(), new BigDecimal("100")));
        long conta = v.get("contasReceber").get(0).get("id").asLong();
        receberPrazo(conta, destino.getId(), 2); receberPrazo(conta, destino.getId(), 3);
        receberPrazo(v.get("contasReceber").get(1).get("id").asLong(), destino.getId(), 7);
        assertThat(movimentosFinanceiros.count()).isEqualTo(5);
        cancelarPrazo(id, 200); cancelarPrazo(id, 200);
        assertThat(contasReceber.findAll()).allSatisfy(c -> { assertThat(c.getStatus()).isEqualTo(StatusContaReceber.CANCELADA); assertThat(c.getValorRecebido()).isZero(); });
        assertThat(movimentosFinanceiros.findAll()).hasSize(5).allSatisfy(m -> assertThat(m.isEstornada()).isTrue());
        contasFinanceiras.findAll().forEach(c -> assertThat(c.getSaldoAtual()).isEqualByComparingTo(saldos.get(c.getId())));
        assertThat(jdbc.queryForObject("select status from recebiveis where id=?", String.class, recebivel)).isEqualTo("CANCELADO");
        assertThat(jdbc.queryForObject("select sum(case when tipo='VENDA' then valor else -valor end) from movimentacoes_caixa", BigDecimal.class)).isZero();
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
    }

    @Test void prazoFalhaNoSegundoEstornoReverteCancelamentoInteiro() throws Exception {
        var v = enviarPrazo(pedidoPrazo("1,4"), 201); long id = v.get("id").asLong();
        var banco = contasFinanceiras.findAll().getFirst();
        long r = jdbc.queryForObject("select id from recebiveis", Long.class);
        mvc.perform(post("/financeiro/recebiveis/" + r + "/liquidar").header("Authorization", authorization)).andExpect(status().isOk());
        long conta = v.get("contasReceber").get(0).get("id").asLong(); receberPrazo(conta, banco.getId(), 2); receberPrazo(conta, banco.getId(), 3);
        var chamadas = new AtomicInteger();
        doAnswer(a -> { var valor = a.callRealMethod(); if (chamadas.incrementAndGet() == 2) throw new IllegalStateException("falha controlada"); return valor; })
                .when(financeiroService).estornarEntradaContaReceber(anyLong(), anyLong(), anyLong(), anyString());
        cancelarPrazo(id, 500);
        assertThat(vendas.findById(id).orElseThrow().getStatus()).isEqualTo(StatusVenda.FATURADA);
        assertThat(contasFinanceiras.findById(banco.getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo("107");
        assertThat(contasReceber.findById(conta).orElseThrow().getValorRecebido()).isEqualByComparingTo("5");
        assertThat(movimentosFinanceiros.findAll()).allSatisfy(m -> assertThat(m.isEstornada()).isFalse());
        assertThat(jdbc.queryForObject("select status from recebiveis where id=?", String.class, r)).isEqualTo("LIQUIDADO");
        assertThat(movimentos.count()).isEqualTo(1); assertThat(movimentosCaixa.count()).isEqualTo(1);
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("8");
    }

    @Test void prazoContaVinculadaNaoPodeSerEditadaOuCanceladaIsoladamente() throws Exception {
        long conta = enviarPrazo(pedidoPrazo(""), 201).get("contasReceber").get(0).get("id").asLong();
        var cliente = clientes.findAll().getFirst();
        mvc.perform(put("/financeiro/contas-receber/" + conta).header("Authorization", authorization).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("clienteId", cliente.getId(), "descricao", "Outro", "valorOriginal", 1, "dataVencimento", LocalDate.now().toString()))))
                .andExpect(status().isConflict());
        mvc.perform(post("/financeiro/contas-receber/" + conta + "/cancelar").header("Authorization", authorization)).andExpect(status().isConflict());
    }

    @Test void prazoGetECancelamentoOutroTenantNaoTemEfeito() throws Exception {
        long id = enviarPrazo(pedidoPrazo(""), 201).get("id").asLong();
        var u = new UsuarioEntity(); u.setEmpresa(outra); u.setCpf("52998224725"); u.setNomeUsuario("Outro"); u.setSenha("hash"); u.setPerfil(PerfilUsuario.ADMIN);
        String token = "Bearer " + jwt.gerarToken(usuarios.saveAndFlush(u));
        mvc.perform(get("/vendas/" + id).header("Authorization", token)).andExpect(status().isNotFound());
        mvc.perform(post("/vendas/" + id + "/cancelar").header("Authorization", token)).andExpect(status().isNotFound());
        assertThat(contasReceber.findAll()).allSatisfy(c -> assertThat(c.getStatus()).isEqualTo(StatusContaReceber.PENDENTE));
    }

    Map<String, Object> pedidoPrazo(String formas) {
        var p = new HashMap<String, Object>();
        p.put("chaveRequisicao", UUID.randomUUID()); p.put("clienteId", clientePrazo(empresa).getId());
        p.put("itens", List.of(Map.of("produtoId", produto.getId(), "quantidade", 2, "precoUnitarioEsperado", 10)));
        p.put("desconto", 0); p.put("totalEsperado", 20);
        var ps = new ArrayList<Map<String, Object>>();
        if (!formas.isEmpty()) for (var f : formas.split(",")) {
            var forma = catalogo.findById(Long.valueOf(f)).orElseThrow();
            var destino = forma.getTipo() == TipoFormaPagamento.DINHEIRO ? null : contasFinanceiras.saveAndFlush(
                    new ContaFinanceiraEntity(empresa, "Banco " + f, TipoContaFinanceira.BANCO, new BigDecimal("100")));
            var config = configuracoes.saveAndFlush(new ConfiguracaoFormaPagamentoEmpresaEntity(empresa, forma, "Forma " + f, true, destino));
            var pp = new HashMap<String, Object>(Map.of("configuracaoFormaPagamentoId", config.getId(), "valor", 2));
            if (forma.getTipo() == TipoFormaPagamento.DINHEIRO) pp.put("valorRecebido", 3);
            ps.add(pp);
        }
        p.put("pagamentos", ps);
        int valor = (20 - ps.size() * 2) / 2;
        p.put("parcelasPrazo", List.of(Map.of("valor", valor, "vencimento", LocalDate.now().plusDays(30).toString()),
                Map.of("valor", valor, "vencimento", LocalDate.now().plusDays(60).toString())));
        return p;
    }
    ClienteEntity clientePrazo(EmpresaEntity e) {
        var c = new ClienteEntity(); c.setEmpresa(e); c.setNome("Cliente prazo"); c.setTipoPessoa(TipoPessoa.FISICA); c.setAtivo(true); return clientes.saveAndFlush(c);
    }
    JsonNode enviarPrazo(Map<String, Object> p, int status) throws Exception {
        var res = mvc.perform(post("/vendas").header("Authorization", authorization).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(p)))
                .andExpect(status().is(status)).andReturn().getResponse();
        return status == 201 ? json.readTree(res.getContentAsString()) : null;
    }
    void cancelarPrazo(long id, int status) throws Exception {
        mvc.perform(post("/vendas/" + id + "/cancelar").header("Authorization", authorization)).andExpect(status().is(status));
    }
    void receberPrazo(long conta, long destino, int valor) throws Exception {
        mvc.perform(post("/financeiro/contas-receber/" + conta + "/receber").header("Authorization", authorization).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("contaFinanceiraId", destino, "valor", valor, "dataRecebimento", LocalDate.now().toString(), "chaveRequisicao", UUID.randomUUID()))))
                .andExpect(status().isOk());
    }
}
