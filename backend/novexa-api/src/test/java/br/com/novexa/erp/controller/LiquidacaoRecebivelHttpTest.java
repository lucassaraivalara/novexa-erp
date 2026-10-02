package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.ContaFinanceiraRepository;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class LiquidacaoRecebivelHttpTest extends RecebivelHttpTest {
    @MockitoSpyBean ContaFinanceiraRepository contas;
    ContaFinanceiraEntity destino;
    ConfiguracaoFormaPagamentoEmpresaEntity config;
    long vendaId;

    @AfterEach void resetContas() { reset(contas); }

    long prepararCartao() throws Exception { return prepararCartao(4L); }
    long prepararCartao(long forma) throws Exception {
        destino = contas.saveAndFlush(new ContaFinanceiraEntity(fluxo.empresa, "Carteira historica",
                TipoContaFinanceira.CARTEIRA_DIGITAL, new BigDecimal("100")));
        config = fluxo.configuracoes.saveAndFlush(new ConfiguracaoFormaPagamentoEmpresaEntity(fluxo.empresa,
                fluxo.catalogo.findById(forma).orElseThrow(), "Cartao historico", true, destino));
        var p = pedido(forma == 3L ? "CARTAO_DEBITO" : "CARTAO_CREDITO"); p.put("configuracaoFormaPagamentoId", config.getId());
        vendaId = enviar(p);
        return recebiveis.findAll().getFirst().getId();
    }
    org.springframework.test.web.servlet.ResultActions liquidar(long id) throws Exception {
        return fluxo.mvc.perform(post("/financeiro/recebiveis/" + id + "/liquidar").header("Authorization", fluxo.authorization));
    }
    BigDecimal saldo() { return contas.findById(destino.getId()).orElseThrow().getSaldoAtual(); }
    long prepararCartaoComTaxas(long forma, String percentual, String fixa, int prazo, int quantidade) throws Exception {
        destino = contas.saveAndFlush(new ContaFinanceiraEntity(fluxo.empresa, "Destino com taxas",
                TipoContaFinanceira.CARTEIRA_DIGITAL, new BigDecimal("100")));
        config = fluxo.configuracoes.saveAndFlush(new ConfiguracaoFormaPagamentoEmpresaEntity(fluxo.empresa,
                fluxo.catalogo.findById(forma).orElseThrow(), "Cartao com taxas", true, destino));
        editarTaxas(forma, percentual, fixa, prazo);
        var p = pedido(forma == 3 ? "CARTAO_DEBITO" : "CARTAO_CREDITO");
        p.put("configuracaoFormaPagamentoId", config.getId());
        p.put("itens", List.of(Map.of("produtoId", fluxo.produto.getId(), "quantidade", quantidade, "precoUnitarioEsperado", 10)));
        p.put("totalEsperado", quantidade * 10);
        p.put("valorRecebido", quantidade * 10);
        vendaId = enviar(p);
        return recebiveis.findAll().getFirst().getId();
    }
    void editarTaxas(long forma, String percentual, String fixa, int prazo) throws Exception {
        var p = Map.of("formaPagamentoId", forma, "nomeExibicao", config.getNomeExibicao(), "ativo", true,
                "contaFinanceiraDestinoId", destino.getId(), "taxaPercentual", percentual,
                "taxaFixa", fixa, "prazoRecebimentoDias", prazo);
        fluxo.mvc.perform(put("/financeiro/configuracoes-formas-pagamento/" + config.getId())
                .header("Authorization", fluxo.authorization).contentType("application/json")
                .content(fluxo.json.writeValueAsBytes(p))).andExpect(status().isOk());
    }
    @ParameterizedTest @ValueSource(longs = {3, 4})
    void cemReaisComTresPorCentoLiquida97ECancelaExatamente97(long forma) throws Exception {
        long id = prepararCartaoComTaxas(forma, "3", "0", 30, 10);
        var r = recebiveis.findById(id).orElseThrow();
        assertThat(r.getValorBruto()).isEqualByComparingTo("100");
        assertThat(r.getTaxaPercentualSnapshot()).isEqualByComparingTo("3");
        assertThat(r.getValorTaxasPrevisto()).isEqualByComparingTo("3");
        assertThat(r.getValorLiquidoPrevisto()).isEqualByComparingTo("97");
        assertThat(r.getDataPrevistaRecebimento()).isEqualTo(r.getDataVenda().toLocalDate().plusDays(30));
        liquidar(id).andExpect(status().isOk()).andExpect(jsonPath("$.valorLiquidoRecebido").value(97));
        liquidar(id).andExpect(status().isOk());
        assertThat(saldo()).isEqualByComparingTo("197");
        assertThat(fluxo.movimentosFinanceiros.findAll()).singleElement().satisfies(m -> assertThat(m.getValor()).isEqualByComparingTo("97"));
        cancelar(vendaId); cancelar(vendaId);
        assertThat(saldo()).isEqualByComparingTo("100");
        assertThat(fluxo.movimentosFinanceiros.findAll().getFirst().isEstornada()).isTrue();
        assertThat(recebiveis.findById(id).orElseThrow().getStatus()).isEqualTo(StatusRecebivel.CANCELADO);
    }
    @Test void taxaFixaSomadaAoPercentual() throws Exception {
        long id = prepararCartaoComTaxas(4, "3", "0.50", 30, 10);
        listar("").andExpect(jsonPath("$.items[0].taxaFixaSnapshot").value(0.5))
                .andExpect(jsonPath("$.items[0].valorTaxasPrevisto").value(3.5))
                .andExpect(jsonPath("$.items[0].valorLiquidoPrevisto").value(96.5))
                .andExpect(jsonPath("$.items[0].prazoRecebimentoDiasSnapshot").value(30));
        liquidar(id).andExpect(status().isOk()); assertThat(saldo()).isEqualByComparingTo("196.50");
        cancelar(vendaId); assertThat(saldo()).isEqualByComparingTo("100");
    }
    @Test void falhaAposCreditoLiquidoReverteSaldoMovimentoEAuditoria() throws Exception {
        long id = prepararCartaoComTaxas(4, "3", "0.50", 30, 2);
        doAnswer(i -> {
            contas.save((ContaFinanceiraEntity) i.getArgument(0)); contas.flush();
            throw new IllegalStateException("falha depois do credito liquido");
        }).when(contas).saveAndFlush(any(ContaFinanceiraEntity.class));
        assertThatThrownBy(() -> liquidar(id)).hasRootCauseMessage("falha depois do credito liquido");
        assertThat(saldo()).isEqualByComparingTo("100"); assertThat(fluxo.movimentosFinanceiros.count()).isZero();
        var r = recebiveis.findById(id).orElseThrow();
        assertThat(r.getStatus()).isEqualTo(StatusRecebivel.PENDENTE);
        assertThat(r.getDataLiquidacao()).isNull(); assertThat(r.getValorLiquidoRecebido()).isNull();
        assertThat(r.getValorLiquidoPrevisto()).isEqualByComparingTo("18.90");
    }
    @Test void arredondaPercentualHalfUpUmaVezNoCentavo() throws Exception {
        long id = prepararCartaoComTaxas(3, "0.025", "0.01", 1, 2);
        var r = recebiveis.findById(id).orElseThrow();
        assertThat(r.getValorTaxasPrevisto()).isEqualByComparingTo("0.02");
        assertThat(r.getValorLiquidoPrevisto()).isEqualByComparingTo("19.98");
    }
    @Test void configuracaoNovaNaoReinterpretaSnapshotEContratoAntigoDeEdicaoNaoApagaTaxas() throws Exception {
        long a = prepararCartaoComTaxas(4, "3", "0", 30, 2);
        atualizarConfiguracao(config.getId(), config.getNomeExibicao(), destino.getId(), true).andExpect(status().isOk());
        assertThat(fluxo.configuracoes.findById(config.getId()).orElseThrow().getTaxaPercentual()).isEqualByComparingTo("3");
        editarTaxas(4, "5", "0", 15);
        var p = pedido("CARTAO_CREDITO"); p.put("configuracaoFormaPagamentoId", config.getId());
        long b = enviar(p); assertThat(enviar(p)).isEqualTo(b);
        var antigo = recebiveis.findById(a).orElseThrow();
        assertThat(antigo.getTaxaPercentualSnapshot()).isEqualByComparingTo("3");
        assertThat(antigo.getValorLiquidoPrevisto()).isEqualByComparingTo("19.40");
        assertThat(antigo.getDataPrevistaRecebimento()).isEqualTo(antigo.getDataVenda().toLocalDate().plusDays(30));
        var novo = recebiveis.findAll().stream().filter(r -> r.getVenda().getId().equals(b)).findFirst().orElseThrow();
        assertThat(novo.getTaxaPercentualSnapshot()).isEqualByComparingTo("5");
        assertThat(novo.getValorLiquidoPrevisto()).isEqualByComparingTo("19");
        assertThat(novo.getDataPrevistaRecebimento()).isEqualTo(novo.getDataVenda().toLocalDate().plusDays(15));
        assertThat(fluxo.pagamentos.findById(antigo.getPagamento().getId()).orElseThrow().getTaxaPercentualSnapshot()).isEqualByComparingTo("3");
        liquidar(a).andExpect(status().isOk()); assertThat(saldo()).isEqualByComparingTo("119.40");
    }
    @ParameterizedTest @ValueSource(strings = {"100:0", "0:20.01"})
    void liquidoZeroOuNegativoRejeitaVendaComRollbackIntegral(String taxas) throws Exception {
        destino = contas.saveAndFlush(new ContaFinanceiraEntity(fluxo.empresa, "Destino", TipoContaFinanceira.CARTEIRA_DIGITAL, BigDecimal.ZERO));
        config = fluxo.configuracoes.saveAndFlush(new ConfiguracaoFormaPagamentoEmpresaEntity(fluxo.empresa,
                fluxo.catalogo.findById(4L).orElseThrow(), "Taxas", true, destino));
        var partes = taxas.split(":"); editarTaxas(4, partes[0], partes[1], 0);
        var p = pedido("CARTAO_CREDITO"); p.put("configuracaoFormaPagamentoId", config.getId());
        fluxo.mvc.perform(post("/vendas").header("Authorization", fluxo.authorization).contentType("application/json")
                .content(fluxo.json.writeValueAsBytes(p))).andExpect(status().isConflict());
        assertThat(fluxo.vendas.count()).isZero(); assertThat(fluxo.pagamentos.count()).isZero();
        assertThat(recebiveis.count()).isZero(); assertThat(fluxo.movimentos.count()).isZero();
        assertThat(fluxo.movimentosFinanceiros.count()).isZero(); assertThat(saldo()).isZero();
        assertThat(fluxo.produtos.findById(fluxo.produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
    }
    @Test void historicoSemSnapshotMantemLiquidoGravadoSemRecalculo() throws Exception {
        long id = prepararCartao();
        fluxo.jdbc.update("update recebiveis set taxa_percentual_snapshot=NULL,taxa_fixa_snapshot=NULL,prazo_recebimento_dias_snapshot=NULL,valor_taxas_previsto=NULL,data_prevista_recebimento=NULL,valor_liquido_previsto=18.50 where id=?", id);
        fluxo.jdbc.update("update pagamentos set taxa_percentual_snapshot=NULL,taxa_fixa_snapshot=NULL,prazo_recebimento_dias_snapshot=NULL");
        editarTaxas(4, "5", "1", 15);
        liquidar(id).andExpect(status().isOk()).andExpect(jsonPath("$.taxaPercentualSnapshot").doesNotExist());
        assertThat(saldo()).isEqualByComparingTo("118.50");
        cancelar(vendaId); assertThat(saldo()).isEqualByComparingTo("100");
    }

    @ParameterizedTest @ValueSource(strings = {"ADMIN", "GERENTE", "OPERADOR", "USUARIO"})
    void liquidacaoRespeitaPerfilSemEfeitoQuandoNegada(String perfil) throws Exception {
        long id = prepararCartao();
        fluxo.segundo.setPerfil(PerfilUsuario.valueOf(perfil));
        fluxo.segundo = fluxo.usuarios.saveAndFlush(fluxo.segundo);
        String token = "Bearer " + fluxo.jwt.gerarToken(fluxo.segundo);
        fluxo.mvc.perform(get("/financeiro/recebiveis").header("Authorization", token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1));
        boolean autorizado = perfil.equals("ADMIN") || perfil.equals("GERENTE");
        for (int tentativa = 0; tentativa < 2; tentativa++) {
            fluxo.mvc.perform(post("/financeiro/recebiveis/" + id + "/liquidar").header("Authorization", token))
                    .andExpect(autorizado ? status().isOk() : status().isForbidden());
        }
        if (autorizado) {
            assertThat(saldo()).isEqualByComparingTo("120");
            assertThat(fluxo.movimentosFinanceiros.findAll()).singleElement().satisfies(m -> {
                assertThat(m.getContaFinanceira().getId()).isEqualTo(destino.getId());
                assertThat(m.getEmpresa().getId()).isEqualTo(fluxo.empresa.getId());
            });
            var r = recebiveis.findById(id).orElseThrow();
            assertThat(r.getStatus()).isEqualTo(StatusRecebivel.LIQUIDADO);
            assertThat(r.getUsuarioLiquidacao().getId()).isEqualTo(fluxo.segundo.getId());
        } else assertPendenteSemEfeito(id);
    }

    @Test void liquidacaoSemAutenticacaoRetorna401SemEfeito() throws Exception {
        long id = prepararCartao();
        fluxo.mvc.perform(post("/financeiro/recebiveis/" + id + "/liquidar"))
                .andExpect(status().isUnauthorized());
        assertPendenteSemEfeito(id);
    }

    private void assertPendenteSemEfeito(long id) {
        assertThat(saldo()).isEqualByComparingTo("100");
        assertThat(fluxo.movimentosFinanceiros.count()).isZero();
        var r = recebiveis.findById(id).orElseThrow();
        assertThat(r.getStatus()).isEqualTo(StatusRecebivel.PENDENTE);
        assertThat(r.getDataLiquidacao()).isNull();
        assertThat(r.getValorLiquidoRecebido()).isNull();
        assertThat(r.getUsuarioLiquidacao()).isNull();
        assertThat(r.getDataCancelamento()).isNull();
        assertThat(r.getUsuarioCancelamento()).isNull();
        assertThat(fluxo.vendas.findById(vendaId).orElseThrow().getStatus()).isEqualTo(StatusVenda.FATURADA);
        assertThat(fluxo.pagamentos.findAll().getFirst().getStatus()).isEqualTo(StatusPagamento.REGISTRADO);
    }

    @ParameterizedTest @ValueSource(longs = {3, 4})
    void liquidacaoIntegralAuditadaUmaEntradaSemCreditoNaVenda(long forma) throws Exception {
        long id = prepararCartao(forma);
        assertThat(saldo()).isEqualByComparingTo("100");
        assertThat(fluxo.movimentosFinanceiros.count()).isZero();
        liquidar(id).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("LIQUIDADO"))
                .andExpect(jsonPath("$.valorLiquidoRecebido").value(20))
                .andExpect(jsonPath("$.dataLiquidacao").isNotEmpty())
                .andExpect(jsonPath("$.movimentacaoFinanceiraId").isNotEmpty())
                .andExpect(jsonPath("$.usuarioLiquidacaoId").value(fluxo.operador.getId()));
        liquidar(id).andExpect(status().isOk());
        assertThat(saldo()).isEqualByComparingTo("120");
        assertThat(fluxo.movimentosFinanceiros.findAll()).singleElement().satisfies(m -> {
            assertThat(m.getRecebivel().getId()).isEqualTo(id);
            assertThat(m.getContaFinanceira().getId()).isEqualTo(destino.getId());
            assertThat(m.getEmpresa().getId()).isEqualTo(fluxo.empresa.getId());
            assertThat(m.getTipo()).isEqualTo(TipoMovimentacaoFinanceira.ENTRADA);
            assertThat(m.getOrigem()).isEqualTo(OrigemMovimentacaoFinanceira.RECEBIVEL_LIQUIDACAO);
            assertThat(m.getValor()).isEqualByComparingTo("20");
            assertThat(m.getPagamento()).isNull(); assertThat(m.isEstornada()).isFalse();
        });
        listar("?status=LIQUIDADO&size=1").andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].valorLiquidoRecebido").value(20))
                .andExpect(jsonPath("$.items[0].movimentacaoFinanceiraId").isNotEmpty());
    }
    @ParameterizedTest @ValueSource(booleans = {false, true})
    void usaSnapshotAposMudancaDaConfiguracaoEInativacaoDaConta(boolean inativa) throws Exception {
        long id = prepararCartao();
        var nova = contas.saveAndFlush(new ContaFinanceiraEntity(fluxo.empresa, "Outro destino",
                TipoContaFinanceira.CARTEIRA_DIGITAL, BigDecimal.ZERO));
        config.atualizar("Novo nome", false, nova); fluxo.configuracoes.saveAndFlush(config);
        destino.situacao(!inativa); contas.saveAndFlush(destino);
        liquidar(id).andExpect(status().isOk());
        assertThat(saldo()).isEqualByComparingTo("120");
        assertThat(contas.findById(nova.getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo("0");
        assertThat(recebiveis.findById(id).orElseThrow().getConfiguracaoNomeExibicao()).isEqualTo("Cartao historico");
        cancelar(vendaId); assertThat(saldo()).isEqualByComparingTo("100");
    }
    @Test void pagamentoLegadoSemSnapshotNaoUsaConfiguracaoAtualNemPayload() throws Exception {
        long id = prepararCartao();
        fluxo.jdbc.update("update pagamentos set configuracao_conta_financeira_destino_id=NULL,configuracao_conta_financeira_destino_nome=NULL");
        fluxo.mvc.perform(post("/financeiro/recebiveis/" + id + "/liquidar").header("Authorization", fluxo.authorization)
                .contentType("application/json").content("{\"contaFinanceiraId\":" + destino.getId() + ",\"valor\":999}"))
                .andExpect(status().isConflict());
        assertThat(saldo()).isEqualByComparingTo("100"); assertThat(fluxo.movimentosFinanceiros.count()).isZero();
        assertThat(recebiveis.findById(id).orElseThrow().getStatus()).isEqualTo(StatusRecebivel.PENDENTE);
    }
    @Test void payloadNaoAlteraValorOuDestino() throws Exception {
        long id = prepararCartao();
        fluxo.mvc.perform(post("/financeiro/recebiveis/" + id + "/liquidar").header("Authorization", fluxo.authorization)
                .contentType("application/json").content("{\"contaFinanceiraId\":-1,\"valor\":999,\"empresaId\":-1}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.valorLiquidoRecebido").value(20));
        assertThat(saldo()).isEqualByComparingTo("120");
    }
    @Test void cancelamentoAntesImpedeLiquidacao() throws Exception {
        long id = prepararCartao(); cancelar(vendaId);
        liquidar(id).andExpect(status().isConflict());
        assertThat(saldo()).isEqualByComparingTo("100"); assertThat(fluxo.movimentosFinanceiros.count()).isZero();
    }
    @Test void liquidacaoDepoisCancelamentoRevertePreservaAuditoriaERetry() throws Exception {
        long id = prepararCartao(); liquidar(id).andExpect(status().isOk());
        var original = fluxo.movimentosFinanceiros.findAll().getFirst();
        cancelar(vendaId); cancelar(vendaId);
        assertThat(saldo()).isEqualByComparingTo("100");
        assertThat(fluxo.movimentosFinanceiros.findAll()).singleElement().satisfies(m -> {
            assertThat(m.getId()).isEqualTo(original.getId()); assertThat(m.isEstornada()).isTrue();
            assertThat(m.getUsuarioEstorno().getId()).isEqualTo(fluxo.operador.getId());
            assertThat(m.getDataEstorno()).isNotNull(); assertThat(m.getMotivoEstorno()).contains("Cancelamento da venda");
        });
        var r = recebiveis.findById(id).orElseThrow();
        assertThat(r.getStatus()).isEqualTo(StatusRecebivel.CANCELADO);
        assertThat(r.getDataLiquidacao()).isNotNull(); assertThat(r.getValorLiquidoRecebido()).isEqualByComparingTo("20");
        assertThat(r.getDataCancelamento()).isNotNull();
        assertThat(r.getUsuarioCancelamento().getId()).isEqualTo(fluxo.operador.getId());
        assertThat(fluxo.vendas.findById(vendaId).orElseThrow().getStatus()).isEqualTo(StatusVenda.CANCELADA);
        liquidar(id).andExpect(status().isConflict());
    }
    @Test void saldoInsuficienteNaReversaoCausaRollbackIntegral() throws Exception {
        long id = prepararCartao(); liquidar(id).andExpect(status().isOk());
        fluxo.jdbc.update("update contas_financeiras set saldo_atual=5 where id=?", destino.getId());
        fluxo.mvc.perform(post("/vendas/" + vendaId + "/cancelar").header("Authorization", fluxo.authorization))
                .andExpect(status().isConflict());
        assertThat(saldo()).isEqualByComparingTo("5");
        assertLiquidadoSemEstorno(id);
        assertThat(fluxo.produtos.findById(fluxo.produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("8");
        assertThat(fluxo.movimentos.count()).isEqualTo(1);
    }
    @ParameterizedTest @ValueSource(strings = {"movimento", "saldo", "status"})
    void falhasEmCadaEtapaRevertemTudo(String etapa) throws Exception {
        long id = prepararCartao();
        if (etapa.equals("movimento")) doAnswer(i -> {
            fluxo.movimentosFinanceiros.save((MovimentacaoFinanceiraEntity)i.getArgument(0)); fluxo.movimentosFinanceiros.flush();
            throw new IllegalStateException("falha " + etapa);
        }).when(fluxo.movimentosFinanceiros).saveAndFlush(any(MovimentacaoFinanceiraEntity.class));
        if (etapa.equals("saldo")) doAnswer(i -> {
            contas.save((ContaFinanceiraEntity)i.getArgument(0)); contas.flush(); throw new IllegalStateException("falha " + etapa);
        }).when(contas).saveAndFlush(any(ContaFinanceiraEntity.class));
        if (etapa.equals("status")) doThrow(new IllegalStateException("falha " + etapa))
                .when(recebiveis).saveAndFlush(any(RecebivelEntity.class));
        assertThatThrownBy(() -> liquidar(id)).hasRootCauseMessage("falha " + etapa);
        assertThat(saldo()).isEqualByComparingTo("100"); assertThat(fluxo.movimentosFinanceiros.count()).isZero();
        var r = recebiveis.findById(id).orElseThrow(); assertThat(r.getStatus()).isEqualTo(StatusRecebivel.PENDENTE);
        assertThat(r.getDataLiquidacao()).isNull(); assertThat(r.getValorLiquidoRecebido()).isNull();
    }
    @Test void falhaAposEstornoReverteCancelamentoIntegral() throws Exception {
        long id = prepararCartao(); liquidar(id).andExpect(status().isOk());
        doAnswer(i -> {
            fluxo.movimentosFinanceiros.save((MovimentacaoFinanceiraEntity)i.getArgument(0)); fluxo.movimentosFinanceiros.flush();
            throw new IllegalStateException("falha estorno");
        }).when(fluxo.movimentosFinanceiros).saveAndFlush(any(MovimentacaoFinanceiraEntity.class));
        assertThatThrownBy(() -> cancelar(vendaId)).hasRootCauseMessage("falha estorno");
        assertThat(saldo()).isEqualByComparingTo("120"); assertLiquidadoSemEstorno(id);
        assertThat(fluxo.produtos.findById(fluxo.produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("8");
    }
    void assertLiquidadoSemEstorno(long id) {
        assertThat(recebiveis.findById(id).orElseThrow().getStatus()).isEqualTo(StatusRecebivel.LIQUIDADO);
        assertThat(fluxo.movimentosFinanceiros.findAll().getFirst().isEstornada()).isFalse();
        assertThat(fluxo.vendas.findById(vendaId).orElseThrow().getStatus()).isEqualTo(StatusVenda.FATURADA);
        assertThat(fluxo.pagamentos.findAll().getFirst().getStatus()).isEqualTo(StatusPagamento.REGISTRADO);
    }
    @Test void outroTenantNaoLiquida() throws Exception {
        long id = prepararCartao(); var outro = new UsuarioEntity(); outro.setEmpresa(fluxo.outra);
        outro.setCpf("52998224725"); outro.setSenha("hash"); outro.setNomeUsuario("Outro"); outro.setPerfil(PerfilUsuario.GERENTE);
        outro = fluxo.usuarios.saveAndFlush(outro);
        fluxo.mvc.perform(post("/financeiro/recebiveis/" + id + "/liquidar")
                .header("Authorization", "Bearer " + fluxo.jwt.gerarToken(outro))).andExpect(status().isNotFound());
        assertThat(saldo()).isEqualByComparingTo("100"); assertThat(fluxo.movimentosFinanceiros.count()).isZero();
    }
    @Test void estornoIndividualDaLiquidacaoBloqueado() throws Exception {
        long id = prepararCartao(); liquidar(id).andExpect(status().isOk());
        long movimentoId = fluxo.movimentosFinanceiros.findAll().getFirst().getId();
        fluxo.mvc.perform(patch("/financeiro/movimentacoes-financeiras/" + movimentoId + "/estorno")
                .header("Authorization", fluxo.authorization).contentType("application/json").content("{\"motivoEstorno\":\"Individual\"}"))
                .andExpect(status().isConflict());
        assertThat(saldo()).isEqualByComparingTo("120"); assertLiquidadoSemEstorno(id);
    }
    @Test void configuracaoLegadaExigeRegularizacaoAntesDaNovaVendaSemReinterpretarAntigas() throws Exception {
        var legada = fluxo.configuracoes.saveAndFlush(new ConfiguracaoFormaPagamentoEmpresaEntity(fluxo.empresa,
                fluxo.catalogo.findById(4L).orElseThrow(), "Legada", true, null));
        var p = pedido("CARTAO_CREDITO"); p.put("configuracaoFormaPagamentoId", legada.getId());
        fluxo.mvc.perform(post("/vendas").header("Authorization", fluxo.authorization).contentType("application/json")
                .content(fluxo.json.writeValueAsBytes(p))).andExpect(status().isConflict());
        fluxo.mvc.perform(get("/financeiro/configuracoes-formas-pagamento/" + legada.getId())
                .header("Authorization", fluxo.authorization)).andExpect(status().isOk());
        atualizarConfiguracao(legada.getId(), "Legada", null, false).andExpect(status().isOk());
        destino = contas.saveAndFlush(new ContaFinanceiraEntity(fluxo.empresa, "Destino", TipoContaFinanceira.CARTEIRA_DIGITAL, BigDecimal.ZERO));
        atualizarConfiguracao(legada.getId(), "Regularizada", destino.getId(), true).andExpect(status().isOk());
        enviar(p);
        assertThat(fluxo.pagamentos.findAll().getFirst().getConfiguracaoContaFinanceiraDestinoId()).isEqualTo(destino.getId());
    }
    org.springframework.test.web.servlet.ResultActions atualizarConfiguracao(long id, String nome, Long conta, boolean ativo) throws Exception {
        var p = new HashMap<String,Object>(); p.put("formaPagamentoId", 4); p.put("nomeExibicao", nome); p.put("ativo", ativo);
        if (conta != null) p.put("contaFinanceiraDestinoId", conta);
        return fluxo.mvc.perform(put("/financeiro/configuracoes-formas-pagamento/" + id).header("Authorization", fluxo.authorization)
                .contentType("application/json").content(fluxo.json.writeValueAsBytes(p)));
    }
    @Test void contaHistoricaInativaNaoPodeSerUsadaEmNovaVendaMasPodeLiquidarAntiga() throws Exception {
        long id = prepararCartao(); destino.situacao(false); contas.saveAndFlush(destino);
        var p = pedido("CARTAO_CREDITO"); p.put("configuracaoFormaPagamentoId", config.getId());
        fluxo.mvc.perform(post("/vendas").header("Authorization", fluxo.authorization).contentType("application/json")
                .content(fluxo.json.writeValueAsBytes(p))).andExpect(status().isConflict());
        liquidar(id).andExpect(status().isOk());
    }

    void concorrencia(boolean cancelar) throws Exception {
        long id = prepararCartao();
        executarConcorrencia(cancelar, id, "120");
    }
    void concorrenciaComTaxas(boolean cancelar) throws Exception {
        long id = prepararCartaoComTaxas(4, "3", "0.50", 30, 2);
        executarConcorrencia(cancelar, id, "118.90");
    }
    void executarConcorrencia(boolean cancelar, long id, String saldoEsperado) throws Exception {
        fluxo.segundo.setPerfil(PerfilUsuario.GERENTE); fluxo.usuarios.saveAndFlush(fluxo.segundo);
        String outroToken = "Bearer " + fluxo.jwt.gerarToken(fluxo.segundo);
        var executor = Executors.newFixedThreadPool(2); var inicio = new CountDownLatch(1);
        try {
            var primeira = executor.submit(() -> { inicio.await(); return fluxo.mvc.perform(post("/financeiro/recebiveis/" + id + "/liquidar")
                    .header("Authorization", fluxo.authorization)).andReturn().getResponse().getStatus(); });
            var segunda = executor.submit(() -> { inicio.await(); return fluxo.mvc.perform(post(cancelar ? "/vendas/" + vendaId + "/cancelar"
                    : "/financeiro/recebiveis/" + id + "/liquidar").header("Authorization", outroToken))
                    .andReturn().getResponse().getStatus(); });
            inicio.countDown(); int a = primeira.get(20, TimeUnit.SECONDS), b = segunda.get(20, TimeUnit.SECONDS);
            if (!cancelar) {
                assertThat(a).isEqualTo(200); assertThat(b).isEqualTo(200);
                assertThat(saldo()).isEqualByComparingTo(saldoEsperado); assertThat(fluxo.movimentosFinanceiros.count()).isEqualTo(1);
                assertLiquidadoSemEstorno(id);
            } else {
                assertThat(a).isIn(200, 409); assertThat(b).isEqualTo(200);
                assertThat(saldo()).isEqualByComparingTo("100");
                assertThat(recebiveis.findById(id).orElseThrow().getStatus()).isEqualTo(StatusRecebivel.CANCELADO);
                assertThat(fluxo.vendas.findById(vendaId).orElseThrow().getStatus()).isEqualTo(StatusVenda.CANCELADA);
                assertThat(fluxo.movimentosFinanceiros.count()).isEqualTo(a == 200 ? 1 : 0);
                assertThat(fluxo.movimentosFinanceiros.findAll()).allMatch(MovimentacaoFinanceiraEntity::isEstornada);
            }
        } finally { inicio.countDown(); executor.shutdownNow(); assertThat(executor.awaitTermination(5, TimeUnit.SECONDS)).isTrue(); }
    }
}
