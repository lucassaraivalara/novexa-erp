package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.service.JwtService;
import br.com.novexa.erp.service.FormaPagamentoService;
import br.com.novexa.erp.dto.FormaPagamentoRequestDTO;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.jdbc.Sql;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:venda;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false",
        "spring.jpa.open-in-view=false", "spring.jpa.show-sql=false",
        "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=60000"
})
@AutoConfigureMockMvc
@Sql("/formas-pagamento-fixture.sql")
class VendaHttpTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired ProdutoRepository produtos;
    @Autowired ClienteRepository clientes;
    @Autowired VendaRepository vendas;
    @Autowired CaixaRepository caixas;
    @Autowired SessaoCaixaRepository sessoes;
    @Autowired MovimentacaoEstoqueRepository movimentos;
    @Autowired LancamentoFinanceiroRepository financeiro;
    @MockitoSpyBean PagamentoRepository pagamentos;
    @MockitoSpyBean MovimentacaoFinanceiraRepository movimentosFinanceiros;
    @MockitoSpyBean MovimentacaoCaixaRepository movimentosCaixa;
    @Autowired JwtService jwt;
    @Autowired FormaPagamentoService formas;
    @Autowired FormaPagamentoRepository catalogo;
    @Autowired ConfiguracaoFormaPagamentoEmpresaRepository configuracoes;
    @Autowired ContaFinanceiraRepository contasFinanceiras;
    @Autowired br.com.novexa.erp.service.SessaoCaixaService sessaoService;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
    EmpresaEntity empresa, outra;
    UsuarioEntity operador, segundo;
    ProdutoEntity produto;
    String authorization;

    @BeforeEach
    void preparar() {
        empresa = empresa("Empresa A", "11222333000181");
        outra = empresa("Empresa B", "12345678000190");
        operador = usuario(empresa, "02360684663");
        operador.setPerfil(PerfilUsuario.GERENTE);
        operador = usuarios.saveAndFlush(operador);
        segundo = usuario(empresa, "11144477735");
        produto = produto(empresa, "Produto", "10.00", "10.000");
        authorization = "Bearer " + jwt.gerarToken(operador);
        var caixa = new CaixaEntity(); caixa.setEmpresa(empresa); caixa.setDescricao("Caixa");
        sessoes.saveAndFlush(new SessaoCaixaEntity(caixas.saveAndFlush(caixa), operador, BigDecimal.ZERO));
    }

    @AfterEach
    void limpar() {
        reset(pagamentos, movimentosFinanceiros, movimentosCaixa);
        jdbc.update("delete from movimentacoes_caixa");
        jdbc.update("delete from movimentacoes_financeiras");
        jdbc.update("delete from contas_receber");
        jdbc.update("delete from recebiveis");
        jdbc.update("delete from pagamentos");
        jdbc.update("delete from lancamentos_financeiros");
        jdbc.update("delete from itens_venda");
        jdbc.update("delete from vendas");
        configuracoes.deleteAllInBatch();
        contasFinanceiras.deleteAllInBatch();
        jdbc.update("delete from formas_pagamento");
        movimentos.deleteAll();
        produtos.deleteAll();
        clientes.deleteAll();
        sessoes.deleteAllInBatch();
        caixas.deleteAllInBatch();
        usuarios.deleteAll();
        empresas.deleteAll();
    }

    @Test
    void dinheiroGravaVendaEstoqueEFinanceiroUmaVezMesmoAoRepetir() throws Exception {
        var pedido = pedido();
        pedido.put("desconto", 1);
        pedido.put("totalEsperado", 19);
        pedido.put("valorRecebido", 25);
        // Não permite escolher empresa, operador ou preços por propriedades extras.
        pedido.put("empresaId", outra.getId());
        pedido.put("usuarioId", segundo.getId());
        long id = enviar(pedido);
        assertThat(vendas.findById(id).orElseThrow().getStatus()).isEqualTo(StatusVenda.FATURADA);
        mvc.perform(post("/vendas").header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(pedido)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.total").value(19)).andExpect(jsonPath("$.troco").value(6));
        assertThat(vendas.count()).isEqualTo(1);
        assertThat(movimentos.count()).isEqualTo(1);
        var movimento = movimentos.findAll().getFirst();
        assertThat(movimento.getEmpresa().getId()).isEqualTo(empresa.getId());
        assertThat(movimento.getUsuario().getId()).isEqualTo(operador.getId());
        assertThat(movimento.getOrigem()).isEqualTo(OrigemMovimentacaoEstoque.VENDA);
        assertThat(movimento.getTipo()).isEqualTo(TipoMovimentacaoEstoque.SAIDA);
        assertThat(movimento.getSaldoAnterior()).isEqualByComparingTo("10");
        assertThat(movimento.getSaldoPosterior()).isEqualByComparingTo("8");
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("8");
        assertThat(financeiro.count()).isZero();
        assertThat(pagamentos.count()).isEqualTo(1);
        var pagamento = pagamentos.findAll().getFirst();
        assertThat(pagamento.getVenda().getId()).isEqualTo(id);
        assertThat(pagamento.getEmpresa().getId()).isEqualTo(empresa.getId());
        assertThat(pagamento.getUsuario().getId()).isEqualTo(operador.getId());
        assertThat(pagamento.getChaveRequisicao()).isEqualTo(pedido.get("chaveRequisicao"));
        assertThat(pagamento.getSequencia()).isEqualTo(1);
        assertThat(pagamento.getFormaPagamento()).isEqualTo(FormaPagamento.DINHEIRO);
        assertThat(pagamento.getValor()).isEqualByComparingTo("19");
        assertThat(pagamento.getValorRecebido()).isEqualByComparingTo("25");
        assertThat(pagamento.getTroco()).isEqualByComparingTo("6");
        assertThat(pagamento.getStatus()).isEqualTo(StatusPagamento.REGISTRADO);
        assertThat(pagamento.getDataHora()).isNotNull();
        mvc.perform(get("/vendas/" + id).header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.itens[0].movimentacaoEstoqueId").value(movimento.getId()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"1", "1,2", "1,3", "2,4", "1,2,4", "3,4", "3,3"})
    void mistoProcessaCadaFormaComSequenciaSnapshotEReenvioSeguro(String formas) throws Exception {
        long[] ids = Arrays.stream(formas.split(",")).mapToLong(Long::parseLong).toArray();
        var pedido = pedidoMisto(ids);
        long id = enviar(pedido);
        assertThat(enviar(pedido)).isEqualTo(id);
        var registros = pagamentos.findByEmpresaIdAndVendaIdOrderBySequenciaAsc(empresa.getId(), id);
        assertThat(registros).hasSize(ids.length);
        for (int i = 0; i < ids.length; i++) {
            var p = registros.get(i);
            assertThat(p.getSequencia()).isEqualTo(i + 1);
            assertThat(p.getForma().getId()).isEqualTo(ids[i]);
            assertThat(p.getEmpresa().getId()).isEqualTo(empresa.getId());
            assertThat(p.getConfiguracaoNomeExibicao()).isNotBlank();
            if (ids[i] >= 3) {
                assertThat(p.getTaxaPercentualSnapshot()).isEqualByComparingTo("3");
                assertThat(p.getPrazoRecebimentoDiasSnapshot()).isEqualTo(30);
                assertThat(p.getConfiguracaoContaFinanceiraDestinoId()).isNotNull();
            }
        }
        assertThat(jdbc.queryForObject("select count(*) from recebiveis", Integer.class))
                .isEqualTo((int) Arrays.stream(ids).filter(forma -> forma == 3 || forma == 4).count());
        assertThat(jdbc.queryForObject("select count(*) from movimentacoes_financeiras", Integer.class)).isZero();
        assertThat(movimentosCaixa.count()).isEqualTo(Arrays.stream(ids).filter(forma -> forma == 1).count());
        assertThat(movimentos.count()).isEqualTo(1);
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("8");
        mvc.perform(get("/vendas/" + id + "/pagamentos").header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(ids.length));
    }

    @Test
    void mistoDinheiroPixCreditoConfirmaLiquidaECancelaTodosPeloValorDaParcela() throws Exception {
        var pedido = pedidoMisto(1, 2, 4);
        pedido.put("itens", List.of(Map.of("produtoId", produto.getId(), "quantidade", 10, "precoUnitarioEsperado", 10)));
        pedido.put("totalEsperado", 100);
        var partes = parcelas(pedido);
        partes.get(0).put("valor", 40); partes.get(0).put("valorRecebido", 50);
        partes.get(1).put("valor", 30); partes.get(2).put("valor", 30);
        long venda = enviar(pedido);
        var registros = pagamentos.findByEmpresaIdAndVendaIdOrderBySequenciaAsc(empresa.getId(), venda);
        assertThat(registros.get(0).getValor()).isEqualByComparingTo("40");
        assertThat(registros.get(0).getTroco()).isEqualByComparingTo("10");
        assertThat(movimentosCaixa.findAll().getFirst().getValor()).isEqualByComparingTo("40");
        assertThat(vendas.findById(venda).orElseThrow().getTroco()).isEqualByComparingTo("10");
        long pix = registros.get(1).getId();
        long cartao = registros.get(2).getId();
        long destinoPix = registros.get(1).getConfiguracaoContaFinanceiraDestinoId();
        long destinoCartao = registros.get(2).getConfiguracaoContaFinanceiraDestinoId();
        long recebivel = jdbc.queryForObject("select id from recebiveis where pagamento_id=?", Long.class, cartao);
        assertThat(jdbc.queryForObject("select valor_bruto from recebiveis where id=?", BigDecimal.class, recebivel)).isEqualByComparingTo("30");
        assertThat(jdbc.queryForObject("select valor_liquido_previsto from recebiveis where id=?", BigDecimal.class, recebivel)).isEqualByComparingTo("29.10");
        assertThat(jdbc.queryForObject("select data_prevista_recebimento from recebiveis where id=?", java.sql.Date.class, recebivel).toLocalDate())
                .isEqualTo(vendas.findById(venda).orElseThrow().getDataHora().toLocalDate().plusDays(30));
        confirmarPix(pix, authorization).andExpect(status().isOk());
        confirmarPix(pix, authorization).andExpect(status().isOk());
        for (int i = 0; i < 2; i++) mvc.perform(post("/financeiro/recebiveis/" + recebivel + "/liquidar")
                .header(HttpHeaders.AUTHORIZATION, authorization)).andExpect(status().isOk());
        assertThat(contasFinanceiras.findById(destinoPix).orElseThrow().getSaldoAtual()).isEqualByComparingTo("130");
        assertThat(contasFinanceiras.findById(destinoCartao).orElseThrow().getSaldoAtual()).isEqualByComparingTo("129.10");
        doThrow(new IllegalStateException("Falha controlada no estorno PIX")).when(movimentosFinanceiros)
                .saveAndFlush(argThat(m -> m != null && m.getOrigem() == OrigemMovimentacaoFinanceira.PAGAMENTO_PIX && m.isEstornada()));
        cancelarPix(venda).andExpect(status().isInternalServerError());
        assertThat(vendas.findById(venda).orElseThrow().getStatus()).isEqualTo(StatusVenda.FATURADA);
        assertThat(pagamentos.findByEmpresaIdAndVendaIdOrderBySequenciaAsc(empresa.getId(), venda))
                .allMatch(p -> p.getStatus() == StatusPagamento.REGISTRADO);
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("0");
        assertThat(movimentos.count()).isEqualTo(1);
        assertThat(movimentosCaixa.count()).isEqualTo(1);
        assertThat(jdbc.queryForObject("select status from recebiveis where id=?", String.class, recebivel)).isEqualTo("LIQUIDADO");
        assertThat(movimentosFinanceiros.findAll()).noneMatch(MovimentacaoFinanceiraEntity::isEstornada);
        assertThat(contasFinanceiras.findById(destinoPix).orElseThrow().getSaldoAtual()).isEqualByComparingTo("130");
        assertThat(contasFinanceiras.findById(destinoCartao).orElseThrow().getSaldoAtual()).isEqualByComparingTo("129.10");
        reset(movimentosFinanceiros);
        for (int i = 0; i < 2; i++) cancelarPix(venda).andExpect(status().isOk());
        assertThat(contasFinanceiras.findById(destinoPix).orElseThrow().getSaldoAtual()).isEqualByComparingTo("100");
        assertThat(contasFinanceiras.findById(destinoCartao).orElseThrow().getSaldoAtual()).isEqualByComparingTo("100");
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
        assertThat(pagamentos.findAll()).allMatch(p -> p.getStatus() == StatusPagamento.CANCELADO);
        assertThat(jdbc.queryForObject("select status from recebiveis where id=?", String.class, recebivel)).isEqualTo("CANCELADO");
        assertThat(jdbc.queryForObject("select count(*) from movimentacoes_financeiras where estornada=true", Integer.class)).isEqualTo(2);
        assertThat(movimentosCaixa.count()).isEqualTo(2);
        assertThat(jdbc.queryForObject("select valor from movimentacoes_caixa where tipo='ESTORNO_VENDA'", BigDecimal.class)).isEqualByComparingTo("40");
    }

    @ParameterizedTest
    @CsvSource({"19,409", "21,409", "0,400", "-1,400", "0.001,400"})
    void mistoRejeitaSomaOuValorInvalidoSemEfeitos(String valor, int esperado) throws Exception {
        var pedido = pedidoMisto(2); parcelas(pedido).getFirst().put("valor", new BigDecimal(valor));
        assertThat(statusVenda(pedido, authorization)).isEqualTo(esperado);
        exigirMistoSemEfeitos();
    }

    @ParameterizedTest
    @ValueSource(strings = {"inativa", "tenant", "ausente", "naoSuportada"})
    void mistoRejeitaConfiguracaoIndisponivel(String caso) throws Exception {
        var pedido = pedidoMisto(1, 2);
        long id = switch (caso) {
            case "inativa" -> configuracao(empresa, 2, false).getId();
            case "tenant" -> configuracao(outra, 2, true).getId();
            case "naoSuportada" -> configuracao(empresa, 5, true).getId();
            default -> Long.MAX_VALUE;
        };
        parcelas(pedido).get(1).put("configuracaoFormaPagamentoId", id);
        assertThat(statusVenda(pedido, authorization)).isEqualTo(caso.equals("tenant") || caso.equals("ausente") ? 404 : 409);
        exigirMistoSemEfeitos();
    }

    @Test
    void mistoRejeitaDuplicidadeAmbiguidadeListaVaziaEValoresRecebidosInvalidos() throws Exception {
        var duplicado = pedidoMisto(2, 2);
        parcelas(duplicado).get(1).put("configuracaoFormaPagamentoId", parcelas(duplicado).get(0).get("configuracaoFormaPagamentoId"));
        assertThat(statusVenda(duplicado, authorization)).isEqualTo(409);
        var ambiguo = pedidoMisto(1); ambiguo.put("formaPagamento", "DINHEIRO");
        assertThat(statusVenda(ambiguo, authorization)).isEqualTo(400);
        var vazio = pedidoMisto(1); vazio.put("pagamentos", List.of());
        assertThat(statusVenda(vazio, authorization)).isEqualTo(400);
        var semValor = pedidoMisto(1); parcelas(semValor).getFirst().remove("valor");
        assertThat(statusVenda(semValor, authorization)).isEqualTo(400);
        var semConfig = pedidoMisto(1); parcelas(semConfig).getFirst().remove("configuracaoFormaPagamentoId");
        assertThat(statusVenda(semConfig, authorization)).isEqualTo(400);
        var dinheiro = pedidoMisto(1); parcelas(dinheiro).getFirst().put("valorRecebido", 19);
        assertThat(statusVenda(dinheiro, authorization)).isEqualTo(409);
        var pix = pedidoMisto(2); parcelas(pix).getFirst().put("valorRecebido", 21);
        assertThat(statusVenda(pix, authorization)).isEqualTo(409);
        exigirMistoSemEfeitos();
    }

    @ParameterizedTest
    @ValueSource(ints = {2, 3})
    void mistoFalhaNaParcelaReverteVendaEstoquePagamentosECaixa(int falha) throws Exception {
        var pedido = pedidoMisto(1, 2, 4);
        var contador = new java.util.concurrent.atomic.AtomicInteger();
        doAnswer(invocation -> {
            var salvo = pagamentos.saveAndFlush(invocation.getArgument(0));
            if (contador.incrementAndGet() == falha) throw new IllegalStateException("Falha controlada na parcela");
            return salvo;
        }).when(pagamentos).save(any(PagamentoEntity.class));
        assertThat(statusVenda(pedido, authorization)).isEqualTo(500);
        exigirMistoSemEfeitos();
    }

    @Test
    void mistoFalhaFinanceiraNoTerceiroPagamentoReverteTudo() throws Exception {
        var pedido = pedidoMisto(1, 2, 4);
        long id = ((Number) parcelas(pedido).get(2).get("configuracaoFormaPagamentoId")).longValue();
        var config = configuracoes.findById(id).orElseThrow();
        config.atualizarCondicoesCartao(BigDecimal.ZERO, new BigDecimal("100"), 0);
        configuracoes.saveAndFlush(config);
        assertThat(statusVenda(pedido, authorization)).isEqualTo(409);
        exigirMistoSemEfeitos();
    }

    @Test
    void mistoFaturamentoDeVendaAbertaPreservaIdempotenciaERejeitaRetryAlterado() throws Exception {
        long id = abrir(); adicionar(id, produto.getId(), 2);
        var pedido = pedidoMisto(1, 2);
        for (int i = 0; i < 2; i++) mvc.perform(post("/vendas/" + id + "/faturar").header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(pedido)))
                .andExpect(status().isOk());
        parcelas(pedido).getFirst().put("valor", 9);
        mvc.perform(post("/vendas/" + id + "/faturar").header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(pedido))).andExpect(status().isConflict());
        assertThat(pagamentos.count()).isEqualTo(2);
        assertThat(movimentos.count()).isEqualTo(1);
    }

    @Test
    void mistoRetryConcorrenteNaoDuplicaPagamentosEstoqueOuCaixa() throws Exception {
        var pedido = pedidoMisto(1, 2, 4);
        assertThat(simultaneas(() -> statusVenda(pedido, authorization), () -> statusVenda(pedido, authorization)))
                .containsExactly(201, 201);
        assertThat(vendas.count()).isEqualTo(1);
        assertThat(pagamentos.count()).isEqualTo(3);
        assertThat(movimentos.count()).isEqualTo(1);
        assertThat(movimentosCaixa.count()).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from recebiveis", Long.class)).isEqualTo(1);
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("8");
    }

    private Map<String, Object> pedidoMisto(long... formas) {
        var pedido = pedido(); pedido.remove("formaPagamento"); pedido.remove("valorRecebido");
        var partes = new ArrayList<Map<String, Object>>();
        BigDecimal restante = new BigDecimal("20");
        BigDecimal valor = restante.divide(BigDecimal.valueOf(formas.length), 2, java.math.RoundingMode.DOWN);
        for (int i = 0; i < formas.length; i++) {
            var config = configuracao(empresa, formas[i], true);
            if (formas[i] == 3 || formas[i] == 4) {
                config.atualizarCondicoesCartao(new BigDecimal("3"), BigDecimal.ZERO, 30);
                configuracoes.saveAndFlush(config);
            }
            BigDecimal parte = i == formas.length - 1 ? restante : valor;
            partes.add(new HashMap<>(Map.of("configuracaoFormaPagamentoId", config.getId(), "valor", parte)));
            restante = restante.subtract(parte);
        }
        pedido.put("pagamentos", partes);
        return pedido;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parcelas(Map<String, Object> pedido) {
        return (List<Map<String, Object>>) pedido.get("pagamentos");
    }

    private void exigirMistoSemEfeitos() {
        assertThat(vendas.count()).isZero(); assertThat(pagamentos.count()).isZero();
        assertThat(movimentos.count()).isZero(); assertThat(movimentosCaixa.count()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from recebiveis", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from movimentacoes_financeiras", Integer.class)).isZero();
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
    }

    @Test
    void cancelamentoPreservaVendaEReverteEfeitosSemDuplicarNoRetry() throws Exception {
        long id = enviar(pedido());

        for (int tentativa = 0; tentativa < 2; tentativa++) {
            mvc.perform(post("/vendas/" + id + "/cancelar").header(HttpHeaders.AUTHORIZATION, authorization))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(id))
                    .andExpect(jsonPath("$.status").value("CANCELADA"))
                    .andExpect(jsonPath("$.total").value(20))
                    .andExpect(jsonPath("$.itens[0].nomeProduto").value("Produto"));
        }

        assertThat(vendas.count()).isEqualTo(1);
        assertThat(vendas.findById(id).orElseThrow().getStatus()).isEqualTo(StatusVenda.CANCELADA);
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
        assertThat(movimentos.findAll()).hasSize(2)
                .extracting(MovimentacaoEstoqueEntity::getOrigem)
                .containsExactlyInAnyOrder(OrigemMovimentacaoEstoque.VENDA, OrigemMovimentacaoEstoque.CANCELAMENTO);
        assertThat(pagamentos.findAll()).singleElement()
                .extracting(PagamentoEntity::getStatus).isEqualTo(StatusPagamento.CANCELADO);
        assertThat(movimentosCaixa.findAll()).hasSize(2)
                .extracting(MovimentacaoCaixaEntity::getTipo)
                .containsExactlyInAnyOrder(TipoMovimentacaoCaixa.VENDA, TipoMovimentacaoCaixa.ESTORNO_VENDA);
    }

    @Test
    void outraEmpresaNaoCancelaVendaFaturadaNemAlteraSeusEfeitos() throws Exception {
        long id = enviar(pedido());
        var operadorOutraEmpresa = usuario(outra, "52998224725");
        operadorOutraEmpresa.setPerfil(PerfilUsuario.GERENTE);
        operadorOutraEmpresa = usuarios.saveAndFlush(operadorOutraEmpresa);

        mvc.perform(post("/vendas/" + id + "/cancelar")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + jwt.gerarToken(operadorOutraEmpresa)))
                .andExpect(status().isNotFound());

        assertThat(vendas.findById(id).orElseThrow().getStatus()).isEqualTo(StatusVenda.FATURADA);
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("8");
        assertThat(movimentos.findAll()).singleElement()
                .extracting(MovimentacaoEstoqueEntity::getOrigem).isEqualTo(OrigemMovimentacaoEstoque.VENDA);
        assertThat(pagamentos.findAll()).singleElement()
                .extracting(PagamentoEntity::getStatus).isEqualTo(StatusPagamento.REGISTRADO);
        assertThat(movimentosCaixa.findAll()).singleElement()
                .extracting(MovimentacaoCaixaEntity::getTipo).isEqualTo(TipoMovimentacaoCaixa.VENDA);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void cancelamentoPreservaLancamentoHistoricoSemConsultarSuaSituacao(boolean legadoCancelado) throws Exception {
        long id = enviar(pedido());
        assertThat(financeiro.count()).isZero();
        var historico = new LancamentoFinanceiroEntity(vendas.findById(id).orElseThrow());
        if (legadoCancelado) historico.cancelar();
        historico = financeiro.saveAndFlush(historico);
        var situacao = historico.getSituacao();
        for (int tentativa = 0; tentativa < 2; tentativa++)
            mvc.perform(post("/vendas/" + id + "/cancelar").header(HttpHeaders.AUTHORIZATION, authorization))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELADA"));
        var preservado = financeiro.findByVendaIdAndEmpresaId(id, empresa.getId()).orElseThrow();
        assertThat(preservado.getId()).isEqualTo(historico.getId());
        assertThat(preservado.getSituacao()).isEqualTo(situacao);
        assertThat(preservado.getValor()).isEqualByComparingTo("20");
        assertThat(pagamentos.findAll().getFirst().getStatus()).isEqualTo(StatusPagamento.CANCELADO);
        assertThat(movimentosCaixa.count()).isEqualTo(2);
    }

    @Test
    void cancelamentoComSessaoFechadaExplicaConflitoSemEfeitoParcial() throws Exception {
        long id = enviar(pedido());
        var sessao = sessoes.findAll().getFirst();
        sessao.fechar(operador, new BigDecimal("20.00"));
        sessoes.saveAndFlush(sessao);

        mvc.perform(post("/vendas/" + id + "/cancelar").header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isConflict())
                .andExpect(content().string("Sessão de Caixa fechada."));

        assertThat(vendas.findById(id).orElseThrow().getStatus()).isEqualTo(StatusVenda.FATURADA);
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("8");
        assertThat(movimentos.findAll()).singleElement()
                .extracting(MovimentacaoEstoqueEntity::getOrigem).isEqualTo(OrigemMovimentacaoEstoque.VENDA);
        assertThat(pagamentos.findAll()).singleElement()
                .extracting(PagamentoEntity::getStatus).isEqualTo(StatusPagamento.REGISTRADO);
        assertThat(movimentosCaixa.findAll()).singleElement()
                .extracting(MovimentacaoCaixaEntity::getTipo).isEqualTo(TipoMovimentacaoCaixa.VENDA);
    }

    @ParameterizedTest
    @ValueSource(strings = {"PIX", "CARTAO_DEBITO", "CARTAO_CREDITO"})
    void registraFormaEPagamentoSemLancamentoLegado(String forma) throws Exception {
        var pedido = pedido(); pedido.put("formaPagamento", forma);
        if (forma.equals("PIX")) pedido.put("configuracaoFormaPagamentoId", configuracao(empresa, 2, true).getId());
        enviar(pedido);
        assertThat(financeiro.count()).isZero();
        assertThat(pagamentos.findAll()).singleElement().satisfies(pagamento -> {
            assertThat(pagamento.getFormaPagamento()).isEqualTo(FormaPagamento.valueOf(forma));
            assertThat(pagamento.getValor()).isEqualByComparingTo("20");
            assertThat(pagamento.getStatus()).isEqualTo(StatusPagamento.REGISTRADO);
            assertThat(pagamento.getValorRecebido()).isNull();
            assertThat(pagamento.getTroco()).isNull();
        });
    }

    @ParameterizedTest
    @ValueSource(strings = {"estoque", "preco", "total", "desconto", "recebido", "inativo", "produtoOutraEmpresa", "clienteOutraEmpresa", "duplicado", "trocoPix"})
    void rejeitaPedidoInvalidoSemEfeitoParcial(String caso) throws Exception {
        var pedido = pedido();
        switch (caso) {
            case "estoque" -> { produto.setEstoqueAtual(BigDecimal.ONE); produtos.saveAndFlush(produto); }
            case "preco" -> pedido.put("itens", List.of(Map.of("produtoId", produto.getId(), "quantidade", 2, "precoUnitarioEsperado", 1)));
            case "total" -> pedido.put("totalEsperado", 1);
            case "desconto" -> pedido.put("desconto", 20);
            case "recebido" -> pedido.put("valorRecebido", 1);
            case "inativo" -> { produto.setAtivo(false); produtos.saveAndFlush(produto); }
            case "produtoOutraEmpresa" -> pedido.put("itens", List.of(Map.of("produtoId", produto(outra, "Outro", "10", "10").getId(), "quantidade", 2, "precoUnitarioEsperado", 10)));
            case "clienteOutraEmpresa" -> {
                var cliente = new ClienteEntity(); cliente.setEmpresa(outra); cliente.setNome("Outro cliente");
                cliente.setTipoPessoa(TipoPessoa.FISICA); pedido.put("clienteId", clientes.saveAndFlush(cliente).getId());
            }
            case "duplicado" -> pedido.put("itens", List.of(item(), item()));
            case "trocoPix" -> { pedido.put("formaPagamento", "PIX"); pedido.put("valorRecebido", 30); }
        }
        mvc.perform(post("/vendas").header(HttpHeaders.AUTHORIZATION, authorization).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(pedido))).andExpect(status().isConflict());
        assertThat(vendas.count()).isZero();
        assertThat(financeiro.count()).isZero();
        assertThat(pagamentos.count()).isZero();
        assertThat(movimentos.count()).isZero();
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual())
                .isEqualByComparingTo(caso.equals("estoque") ? "1" : "10");
    }

    @Test
    void falhaFinanceiraReverteVendaMovimentoESaldo() throws Exception {
        doAnswer(invocation -> {
            pagamentos.saveAndFlush(invocation.getArgument(0));
            assertThat(pagamentos.count()).isEqualTo(1);
            throw new IllegalStateException("falha simulada");
        }).when(pagamentos).save(any(PagamentoEntity.class));
        mvc.perform(post("/vendas").header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(pedido())))
                .andExpect(status().isInternalServerError());
        assertThat(vendas.count()).isZero();
        assertThat(financeiro.count()).isZero();
        assertThat(pagamentos.count()).isZero();
        assertThat(movimentos.count()).isZero();
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
    }

    @Test
    void produtoSemControleNaoMovimentaEstoqueEQuantidadeFracionadaArredondaPorItem() throws Exception {
        produto.setControlaEstoque(false); produto.setEstoqueAtual(BigDecimal.ZERO); produto.setPrecoVenda(new BigDecimal("0.01"));
        produtos.saveAndFlush(produto);
        var pedido = pedido(); pedido.put("itens", List.of(Map.of("produtoId", produto.getId(), "quantidade", 0.5, "precoUnitarioEsperado", 0.01)));
        pedido.put("totalEsperado", 0.01); pedido.put("valorRecebido", 0.01);
        enviar(pedido);
        assertThat(movimentos.count()).isZero();
        assertThat(pagamentos.findAll().getFirst().getValor()).isEqualByComparingTo("0.01");
    }

    @Test
    void chaveReutilizadaComOutrosDadosRetornaConflito() throws Exception {
        var pedido = pedido(); enviar(pedido); pedido.put("observacoes", "outros dados");
        mvc.perform(post("/vendas").header(HttpHeaders.AUTHORIZATION, authorization).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(pedido))).andExpect(status().isConflict());
        assertThat(vendas.count()).isEqualTo(1);
    }

    @Test
    void clienteDaEmpresaEObservacoesSaoPreservadosESemTokenNaoAcessa() throws Exception {
        var cliente = new ClienteEntity(); cliente.setEmpresa(empresa); cliente.setNome("Cliente");
        cliente.setTipoPessoa(TipoPessoa.FISICA); clientes.saveAndFlush(cliente);
        var pedido = pedido(); pedido.put("clienteId", cliente.getId()); pedido.put("entrega", "Retirar na loja"); pedido.put("observacoes", "Observação");
        long id = enviar(pedido);
        mvc.perform(get("/vendas/" + id).header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.clienteId").value(cliente.getId()))
                .andExpect(jsonPath("$.entrega").value("Retirar na loja")).andExpect(jsonPath("$.observacoes").value("Observação"));
        mvc.perform(post("/vendas").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(pedido))).andExpect(status().isUnauthorized());
        mvc.perform(get("/vendas/" + id)).andExpect(status().isUnauthorized());
        var usuarioOutra = usuario(outra, "52998224725");
        mvc.perform(get("/vendas/" + id).header(HttpHeaders.AUTHORIZATION, "Bearer " + jwt.gerarToken(usuarioOutra)))
                .andExpect(status().isNotFound());
    }

    @Test
    void repeticoesConcorrentesNaoDuplicamVenda() throws Exception {
        byte[] body = json.writeValueAsBytes(pedido());
        try (var executor = Executors.newFixedThreadPool(2)) {
            var inicio = new CountDownLatch(1);
            Callable<Long> enviar = () -> {
                inicio.await();
                var result = mvc.perform(post("/vendas").header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isCreated()).andReturn();
                return json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
            };
            var a = executor.submit(enviar); var b = executor.submit(enviar); inicio.countDown();
            assertThat(a.get(15, TimeUnit.SECONDS)).isEqualTo(b.get(15, TimeUnit.SECONDS));
        }
        assertThat(vendas.count()).isEqualTo(1);
        assertThat(movimentos.count()).isEqualTo(1);
        assertThat(financeiro.count()).isZero();
        assertThat(pagamentos.count()).isEqualTo(1);
    }

    @Test
    void doisOperadoresNaoVendemMesmoSaldo() throws Exception {
        produto.setEstoqueAtual(new BigDecimal("2")); produtos.saveAndFlush(produto);
        String outroToken = "Bearer " + jwt.gerarToken(segundo);
        var inicio = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var a = executor.submit(() -> { inicio.await(); return statusVenda(pedido(), authorization); });
            var b = executor.submit(() -> { inicio.await(); return statusVenda(pedido(), outroToken); });
            inicio.countDown();
            assertThat(List.of(a.get(15, TimeUnit.SECONDS), b.get(15, TimeUnit.SECONDS))).containsExactlyInAnyOrder(201, 409);
        }
        assertThat(vendas.count()).isEqualTo(1);
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("0");
    }


    @Test
    void cicloAbertoViaHttpNaoGeraEfeitosDefinitivos() throws Exception {
        long id = abrir();
        var item = adicionar(id, produto.getId(), 2);
        long itemId = item.get("itens").get(0).get("id").asLong();
        var cliente = new ClienteEntity(); cliente.setEmpresa(empresa); cliente.setNome("Cliente");
        cliente.setTipoPessoa(TipoPessoa.FISICA); clientes.saveAndFlush(cliente);
        mvc.perform(patch("/vendas/" + id + "/itens/" + itemId).header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON).content("{\"quantidade\":3}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.subtotal").value(30))
                .andExpect(jsonPath("$.itens[0].quantidade").value(3));
        mvc.perform(patch("/vendas/" + id + "/desconto").header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON).content("{\"desconto\":5}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(25));
        mvc.perform(put("/vendas/" + id + "/cliente").header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("clienteId", cliente.getId()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.clienteId").value(cliente.getId()));
        mvc.perform(delete("/vendas/" + id + "/cliente").header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.clienteId").isEmpty());
        mvc.perform(patch("/vendas/" + id + "/desconto").header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON).content("{\"desconto\":0}")).andExpect(status().isOk());
        mvc.perform(delete("/vendas/" + id + "/itens/" + itemId).header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.itens").isEmpty())
                .andExpect(jsonPath("$.total").value(0)).andExpect(jsonPath("$.status").value("ABERTA"));
        assertThat(movimentos.count()).isZero();
        assertThat(financeiro.count()).isZero();
        assertThat(pagamentos.count()).isZero();
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
    }

    @Test
    void faturarPreservaPrecoENomeAplicadosEReenvioNaoDuplica() throws Exception {
        long id = abrir();
        var adicionado = adicionar(id, produto.getId(), 2);
        long itemId = adicionado.get("itens").get(0).get("id").asLong();
        produto.setPrecoVenda(new BigDecimal("25"));
        produto.setNome("Nome atualizado");
        produtos.saveAndFlush(produto);
        var pagamento = pagamento();
        for (int tentativa = 0; tentativa < 2; tentativa++) {
            mvc.perform(post("/vendas/" + id + "/faturar").header(HttpHeaders.AUTHORIZATION, authorization)
                    .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(pagamento)))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("FATURADA"))
                    .andExpect(jsonPath("$.total").value(20));
        }
        mvc.perform(get("/vendas/" + id).header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.itens[0].id").value(itemId))
                .andExpect(jsonPath("$.itens[0].nomeProduto").value("Produto"))
                .andExpect(jsonPath("$.itens[0].precoUnitario").value(10))
                .andExpect(jsonPath("$.itens[0].movimentacaoEstoqueId").isNumber());
        pagamento.put("valorRecebido", 30);
        mvc.perform(post("/vendas/" + id + "/faturar").header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(pagamento)))
                .andExpect(status().isConflict());
        assertThat(financeiro.count()).isZero();
        assertThat(pagamentos.count()).isEqualTo(1);
        assertThat(movimentos.count()).isEqualTo(1);
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("8");
    }

    @ParameterizedTest
    @ValueSource(strings = {"adicionar", "quantidade", "remover", "desconto", "cliente", "removerCliente"})
    void faturadaRecusaTodaEdicao(String operacao) throws Exception {
        long id = abrir();
        long itemId = adicionar(id, produto.getId(), 2).get("itens").get(0).get("id").asLong();
        mvc.perform(post("/vendas/" + id + "/faturar").header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(pagamento())))
                .andExpect(status().isOk());
        mvc.perform(operacao(id, itemId, operacao).header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isConflict());
        mvc.perform(get("/vendas/" + id).header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("FATURADA"))
                .andExpect(jsonPath("$.itens.length()").value(1))
                .andExpect(jsonPath("$.itens[0].quantidade").value(2))
                .andExpect(jsonPath("$.desconto").value(0)).andExpect(jsonPath("$.clienteId").isEmpty());
        assertThat(movimentos.count()).isEqualTo(1);
        assertThat(financeiro.count()).isZero();
        assertThat(pagamentos.count()).isEqualTo(1);
    }

    @ParameterizedTest
    @ValueSource(strings = {"adicionar", "quantidade", "remover", "desconto", "cliente", "removerCliente", "faturar", "buscar"})
    void operacoesAbertasNaoAcessamOutroTenant(String operacao) throws Exception {
        long id = abrir();
        long itemId = adicionar(id, produto.getId(), 2).get("itens").get(0).get("id").asLong();
        var operadorB = usuario(outra, "52998224725");
        mvc.perform(operacao(id, itemId, operacao).param("empresaId", empresa.getId().toString())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + jwt.gerarToken(operadorB)))
                .andExpect(status().isNotFound());
        assertThat(vendas.findById(id).orElseThrow().getStatus()).isEqualTo(StatusVenda.ABERTA);
        assertThat(movimentos.count()).isZero();
        assertThat(financeiro.count()).isZero();
        assertThat(pagamentos.count()).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"produto", "cliente"})
    void vendaAbertaRejeitaVinculosDeOutroTenant(String entidade) throws Exception {
        long id = abrir();
        var request = post("/vendas/" + id + "/itens");
        Map<String, Object> dados;
        if (entidade.equals("produto")) {
            var outro = produto(outra, "Outro", "10", "10");
            dados = new HashMap<>(Map.of("produtoId", outro.getId(), "quantidade", 1));
        } else {
            var cliente = new ClienteEntity(); cliente.setEmpresa(outra); cliente.setNome("Outro cliente");
            cliente.setTipoPessoa(TipoPessoa.FISICA); clientes.saveAndFlush(cliente);
            request = put("/vendas/" + id + "/cliente");
            dados = new HashMap<>(Map.of("clienteId", cliente.getId()));
        }
        dados.put("empresaId", outra.getId());
        mvc.perform(request.header(HttpHeaders.AUTHORIZATION, authorization).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(dados))).andExpect(status().isNotFound());
        assertThat(movimentos.count()).isZero();
        assertThat(financeiro.count()).isZero();
        assertThat(pagamentos.count()).isZero();
    }

    @Test
    void falhaFinanceiraNoFaturamentoReverteEPermiteNovaTentativa() throws Exception {
        long id = abrir();
        adicionar(id, produto.getId(), 2);
        doAnswer(invocation -> {
            pagamentos.saveAndFlush(invocation.getArgument(0));
            assertThat(pagamentos.count()).isEqualTo(1);
            throw new IllegalStateException("falha simulada");
        }).when(pagamentos).save(any(PagamentoEntity.class));
        var pagamento = pagamento();
        mvc.perform(post("/vendas/" + id + "/faturar")
                .header(HttpHeaders.AUTHORIZATION, authorization).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(pagamento))).andExpect(status().isInternalServerError());
        assertThat(vendas.findById(id).orElseThrow().getStatus()).isEqualTo(StatusVenda.ABERTA);
        assertThat(movimentos.count()).isZero();
        assertThat(financeiro.count()).isZero();
        assertThat(pagamentos.count()).isZero();
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
        assertThat(jdbc.queryForObject("select count(*) from itens_venda where movimentacao_estoque_id is not null", Long.class)).isZero();
        reset(pagamentos);
        mvc.perform(post("/vendas/" + id + "/faturar").header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(pagamento)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("FATURADA"));
        assertThat(movimentos.count()).isEqualTo(1);
        assertThat(financeiro.count()).isZero();
        assertThat(pagamentos.count()).isEqualTo(1);
    }

    @Test
    void doisOperadoresFaturandoMesmaVendaGeramUmUnicoEfeito() throws Exception {
        long id = abrir();
        adicionar(id, produto.getId(), 2);
        var primeiroGravouPagamento = new CountDownLatch(1);
        var liberarPrimeiro = new CountDownLatch(1);
        var segundoIniciou = new CountDownLatch(1);
        doAnswer(invocation -> {
            PagamentoEntity salvo = pagamentos.saveAndFlush(invocation.getArgument(0));
            primeiroGravouPagamento.countDown();
            assertThat(liberarPrimeiro.await(10, TimeUnit.SECONDS)).isTrue();
            return salvo;
        }).when(pagamentos).save(any(PagamentoEntity.class));
        try (var workers = Executors.newFixedThreadPool(2)) {
            var a = workers.submit(() -> faturarStatus(id, authorization));
            Future<Integer> b;
            try {
                assertThat(primeiroGravouPagamento.await(10, TimeUnit.SECONDS)).isTrue();
                b = workers.submit(() -> {
                    segundoIniciou.countDown();
                    return faturarStatus(id, "Bearer " + jwt.gerarToken(segundo));
                });
                assertThat(segundoIniciou.await(10, TimeUnit.SECONDS)).isTrue();
                assertThatThrownBy(() -> b.get(200, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
            } finally {
                liberarPrimeiro.countDown();
            }
            assertThat(a.get(15, TimeUnit.SECONDS)).isEqualTo(200);
            assertThat(b.get(15, TimeUnit.SECONDS)).isEqualTo(409);
        }
        assertThat(vendas.count()).isEqualTo(1);
        assertThat(vendas.findById(id).orElseThrow().getStatus()).isEqualTo(StatusVenda.FATURADA);
        assertThat(movimentos.count()).isEqualTo(1);
        assertThat(financeiro.count()).isZero();
        assertThat(pagamentos.count()).isEqualTo(1);
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("8");
    }

    @ParameterizedTest
    @ValueSource(strings = {"adicionar", "quantidade", "remover", "desconto", "cliente", "removerCliente", "faturar"})
    void novosEndpointsExigemAutenticacao(String operacao) throws Exception {
        mvc.perform(operacao(1, 1, operacao)).andExpect(status().isUnauthorized());
        mvc.perform(post("/vendas/abertas")).andExpect(status().isUnauthorized());
    }

    @Test
    void naoFaturaVendaVaziaNemReduzItensAbaixoDoDesconto() throws Exception {
        long id = abrir();
        mvc.perform(post("/vendas/" + id + "/faturar").header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(pagamento())))
                .andExpect(status().isConflict());
        long itemId = adicionar(id, produto.getId(), 2).get("itens").get(0).get("id").asLong();
        mvc.perform(patch("/vendas/" + id + "/desconto").header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON).content("{\"desconto\":15}")).andExpect(status().isOk());
        mvc.perform(patch("/vendas/" + id + "/itens/" + itemId).header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON).content("{\"quantidade\":1}")).andExpect(status().isConflict());
        mvc.perform(get("/vendas/" + id).header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.itens[0].quantidade").value(2))
                .andExpect(jsonPath("$.total").value(5));
    }

    @Test
    void consultaPagamentosRespeitaTenantEAutenticacao() throws Exception {
        long id = enviar(pedido());
        mvc.perform(get("/vendas/" + id + "/pagamentos").header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].vendaId").value(id))
                .andExpect(jsonPath("$[0].empresaId").value(empresa.getId()))
                .andExpect(jsonPath("$[0].usuarioId").value(operador.getId()))
                .andExpect(jsonPath("$[0].sequencia").value(1))
                .andExpect(jsonPath("$[0].formaPagamento").value("DINHEIRO"))
                .andExpect(jsonPath("$[0].valor").value(20))
                .andExpect(jsonPath("$[0].status").value("REGISTRADO"))
                .andExpect(jsonPath("$[0].dataHora").isNotEmpty());
        mvc.perform(get("/vendas/" + id + "/pagamentos")).andExpect(status().isUnauthorized());
        var operadorB = usuario(outra, "52998224725");
        mvc.perform(get("/vendas/" + id + "/pagamentos").param("empresaId", empresa.getId().toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + jwt.gerarToken(operadorB)))
                .andExpect(status().isNotFound());
        assertThat(pagamentos.findByEmpresaIdAndVendaIdOrderBySequenciaAsc(outra.getId(), id)).isEmpty();
        assertThat(pagamentos.count()).isEqualTo(1);
    }

    @Test
    void vendaAbertaRetornaListaVaziaDePagamentos() throws Exception {
        long id = abrir();
        adicionar(id, produto.getId(), 2);
        mvc.perform(get("/vendas/" + id + "/pagamentos").header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
        assertThat(pagamentos.count()).isZero();
    }

    @Test
    void pagamentoIdentificaOperadorQueFaturouMesmoQuandoOutroAbriuVenda() throws Exception {
        long id = abrir();
        adicionar(id, produto.getId(), 2);
        abrirCaixa(segundo);
        mvc.perform(post("/vendas/" + id + "/faturar")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + jwt.gerarToken(segundo))
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(pagamento())))
                .andExpect(status().isOk());
        assertThat(pagamentos.findAll()).singleElement().satisfies(pagamento -> {
            assertThat(pagamento.getVenda().getId()).isEqualTo(id);
            assertThat(pagamento.getUsuario().getId()).isEqualTo(segundo.getId());
            assertThat(pagamento.getEmpresa().getId()).isEqualTo(empresa.getId());
        });
        assertThat(vendas.findById(id).orElseThrow().getUsuario().getId()).isEqualTo(operador.getId());
    }

    @Test
    void falhaAoGravarPagamentoReverteEstoqueEVenda() throws Exception {
        long id = abrir();
        adicionar(id, produto.getId(), 2);
        doAnswer(invocation -> {
            pagamentos.saveAndFlush(invocation.getArgument(0));
            assertThat(pagamentos.count()).isEqualTo(1);
            throw new IllegalStateException("falha ao gravar pagamento");
        }).when(pagamentos).save(any(PagamentoEntity.class));
        mvc.perform(post("/vendas/" + id + "/faturar")
                .header(HttpHeaders.AUTHORIZATION, authorization).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(pagamento()))).andExpect(status().isInternalServerError());
        assertThat(pagamentos.count()).isZero();
        assertThat(financeiro.count()).isZero();
        assertThat(movimentos.count()).isZero();
        assertThat(vendas.findById(id).orElseThrow().getStatus()).isEqualTo(StatusVenda.ABERTA);
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
    }

    @Test
    void falhaNoSegundoProdutoRevertePrimeiraBaixaSemCriarPagamento() throws Exception {
        long id = abrir();
        adicionar(id, produto.getId(), 2);
        var insuficiente = produto(empresa, "Saldo insuficiente", "10", "1");
        adicionar(id, insuficiente.getId(), 2);
        var fechamento = pagamento();
        fechamento.put("totalEsperado", 40);
        fechamento.put("valorRecebido", 40);
        mvc.perform(post("/vendas/" + id + "/faturar").header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(fechamento)))
                .andExpect(status().isConflict());
        assertThat(pagamentos.count()).isZero();
        assertThat(financeiro.count()).isZero();
        assertThat(movimentos.count()).isZero();
        assertThat(vendas.findById(id).orElseThrow().getStatus()).isEqualTo(StatusVenda.ABERTA);
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
    }

    @ParameterizedTest
    @ValueSource(longs = {1, 2, 3, 4})
    void fechamentoPorIdPreservaTiposSuportadosEContratoDoPdv(long formaId) throws Exception {
        var pedido = pedido();
        pedido.remove("formaPagamento");
        pedido.put("formaPagamentoId", formaId);
        if (formaId == 2) pedido.put("configuracaoFormaPagamentoId", configuracao(empresa, 2, true).getId());
        long id = enviar(pedido);
        var pagamento = pagamentos.findAll().getFirst();
        assertThat(pagamento.getForma().getId()).isEqualTo(formaId);
        assertThat(pagamento.getFormaPagamento().idPadrao()).isEqualTo(formaId);
        mvc.perform(get("/vendas/" + id + "/pagamentos").header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].formaPagamentoId").value(formaId))
                .andExpect(jsonPath("$[0].formaPagamento").value(pagamento.getFormaPagamento().name()));
        assertThat(financeiro.count()).isZero();
        assertThat(movimentos.count()).isEqualTo(1);
    }

    @Test
    void formaCriadaPodeSerUsadaEHistoricoRetrySobrevivemAInativacao() throws Exception {
        long formaId = formas.criar(new FormaPagamentoRequestDTO("PIX Alternativo", TipoFormaPagamento.PIX, true)).id();
        var pedido = pedido(); pedido.remove("formaPagamento"); pedido.put("formaPagamentoId", formaId);
        pedido.put("configuracaoFormaPagamentoId", configuracao(empresa, formaId, true).getId());
        long id = enviar(pedido);
        formas.atualizar(formaId, new FormaPagamentoRequestDTO("PIX renomeado", TipoFormaPagamento.PIX, false));
        assertThat(enviar(pedido)).isEqualTo(id);
        mvc.perform(get("/vendas/" + id + "/pagamentos").header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].formaPagamentoId").value(formaId))
                .andExpect(jsonPath("$[0].tipoFormaPagamento").value("PIX"))
                .andExpect(jsonPath("$[0].formaPagamento").value("PIX"))
                .andExpect(jsonPath("$[0].valor").value(20));
        pedido.put("chaveRequisicao", UUID.randomUUID());
        assertThat(statusVenda(pedido, authorization)).isEqualTo(409);
        assertThat(pagamentos.count()).isEqualTo(1);
        assertThat(vendas.count()).isEqualTo(1);
        assertThat(financeiro.count()).isZero();
        assertThat(movimentos.count()).isEqualTo(1);
    }

    @Test
    void inativacaoTambemBloqueiaCodigoLegadoEVendaAbertaSemEfeitos() throws Exception {
        formas.atualizar(1L, new FormaPagamentoRequestDTO("Dinheiro", TipoFormaPagamento.DINHEIRO, false));
        assertThat(statusVenda(pedido(), authorization)).isEqualTo(409);
        long id = abrir(); adicionar(id, produto.getId(), 2);
        assertThat(faturarStatus(id, authorization)).isEqualTo(409);
        assertThat(vendas.findById(id).orElseThrow().getStatus()).isEqualTo(StatusVenda.ABERTA);
        assertThat(pagamentos.count()).isZero();
        assertThat(financeiro.count()).isZero();
        assertThat(movimentos.count()).isZero();
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
    }

    @Test
    void vendaAbertaFaturaComFormaIdEPreservaRetry() throws Exception {
        long id = abrir(); adicionar(id, produto.getId(), 2);
        var pedido = pagamento(); pedido.remove("formaPagamento"); pedido.put("formaPagamentoId", 2);
        pedido.put("configuracaoFormaPagamentoId", configuracao(empresa, 2, true).getId());
        for (int tentativa = 0; tentativa < 2; tentativa++) {
            mvc.perform(post("/vendas/" + id + "/faturar").header(HttpHeaders.AUTHORIZATION, authorization)
                    .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(pedido)))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("FATURADA"));
        }
        assertThat(pagamentos.count()).isEqualTo(1);
        assertThat(pagamentos.findAll().getFirst().getForma().getId()).isEqualTo(2);
    }

    @ParameterizedTest
    @ValueSource(longs = {5, 6, 999})
    void formaNaoSuportadaOuInexistenteNaoGeraEfeitos(long formaId) throws Exception {
        var pedido = pedido(); pedido.remove("formaPagamento"); pedido.put("formaPagamentoId", formaId);
        assertThat(statusVenda(pedido, authorization)).isEqualTo(formaId == 999 ? 404 : 409);
        assertThat(pagamentos.count()).isZero();
        assertThat(vendas.count()).isZero();
        assertThat(financeiro.count()).isZero();
        assertThat(movimentos.count()).isZero();
    }

    @Test
    void contratoRejeitaFormaAmbiguaAusenteOuIdInvalido() throws Exception {
        var pedido = pedido(); pedido.put("formaPagamentoId", 1);
        assertThat(statusVenda(pedido, authorization)).isEqualTo(400);
        pedido.remove("formaPagamentoId"); pedido.remove("formaPagamento");
        assertThat(statusVenda(pedido, authorization)).isEqualTo(400);
        pedido.put("formaPagamentoId", -1);
        assertThat(statusVenda(pedido, authorization)).isEqualTo(400);
    }

    @Test
    void inativacaoAguardaPagamentoEmCursoENaoAlteraHistorico() throws Exception {
        var pagamentoGravado = new CountDownLatch(1);
        var liberar = new CountDownLatch(1);
        var inativacaoIniciou = new CountDownLatch(1);
        doAnswer(invocation -> {
            var salvo = pagamentos.saveAndFlush(invocation.getArgument(0));
            pagamentoGravado.countDown();
            assertThat(liberar.await(10, TimeUnit.SECONDS)).isTrue();
            return salvo;
        }).when(pagamentos).save(any(PagamentoEntity.class));
        try (var workers = Executors.newFixedThreadPool(2)) {
            var venda = workers.submit(() -> enviar(pedido()));
            Future<Integer> inativacao;
            try {
                assertThat(pagamentoGravado.await(10, TimeUnit.SECONDS)).isTrue();
                inativacao = workers.submit(() -> {
                    inativacaoIniciou.countDown();
                    formas.atualizar(1L, new FormaPagamentoRequestDTO("Dinheiro", TipoFormaPagamento.DINHEIRO, false));
                    return 200;
                });
                assertThat(inativacaoIniciou.await(10, TimeUnit.SECONDS)).isTrue();
                assertThatThrownBy(() -> inativacao.get(200, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
            } finally { liberar.countDown(); }
            assertThat(venda.get(15, TimeUnit.SECONDS)).isPositive();
            assertThat(inativacao.get(15, TimeUnit.SECONDS)).isEqualTo(200);
        }
        assertThat(pagamentos.count()).isEqualTo(1);
        assertThat(pagamentos.findAll().getFirst().getForma().isAtivo()).isFalse();
    }

    @ParameterizedTest @ValueSource(longs = {1, 2, 3, 4})
    void configuracaoValidaVinculaVendaEPagamentoSemNovoEfeitoFinanceiro(long forma) throws Exception {
        var config = configuracao(empresa, forma, true);
        var p = pedido(); p.remove("formaPagamento"); p.put("formaPagamentoId", forma);
        p.put("configuracaoFormaPagamentoId", config.getId());
        long id = enviar(p);
        assertThat(vendas.findById(id).orElseThrow().getConfiguracaoFormaPagamento().getId()).isEqualTo(config.getId());
        mvc.perform(get("/vendas/" + id).header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.configuracaoFormaPagamentoId").value(config.getId()));
        mvc.perform(get("/vendas/" + id + "/pagamentos").header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].configuracaoFormaPagamentoId").value(config.getId()))
                .andExpect(jsonPath("$[0].configuracaoNomeExibicao").value(config.getNomeExibicao()))
                .andExpect(jsonPath("$[0].configuracaoTipo").value(config.getTipo().name()));
        assertThat(pagamentos.findAll().getFirst().getConfiguracaoFormaPagamento().getId()).isEqualTo(config.getId());
        assertThat(jdbc.queryForObject("select count(*) from movimentacoes_financeiras", Long.class)).isZero();
        assertThat(financeiro.count()).isZero();
        assertThat(movimentosCaixa.count()).isEqualTo(forma == 1 ? 1 : 0);
        for (var conta : contasFinanceiras.findAll()) assertThat(conta.getSaldoAtual()).isEqualByComparingTo("100");
        jdbc.update("update configuracoes_formas_pagamento_empresa set ativo=false, nome_exibicao='Renomeada' where id=?", config.getId());
        assertThat(enviar(p)).isEqualTo(id);
        p.put("configuracaoFormaPagamentoId", configuracao(empresa, forma, true).getId());
        assertThat(statusVenda(p, authorization)).isEqualTo(409);
        assertThat(pagamentos.count()).isEqualTo(1);
    }

    @ParameterizedTest @ValueSource(booleans = {false, true})
    void configuracaoInvalidaRejeitadaSemEfeitosNosDoisFluxos(boolean aberta) throws Exception {
        long id = aberta ? abrir() : 0;
        if (aberta) adicionar(id, produto.getId(), 2);
        String url = aberta ? "/vendas/" + id + "/faturar" : "/vendas";
        var p = aberta ? pagamento() : pedido();
        var externa = configuracao(outra, 1, true);
        var inativa = configuracao(empresa, 1, false);
        var diferente = configuracao(empresa, 4, true);
        for (var config : List.of(externa, inativa, diferente)) {
            p.put("configuracaoFormaPagamentoId", config.getId());
            mvc.perform(post(url).header(HttpHeaders.AUTHORIZATION, authorization).contentType(MediaType.APPLICATION_JSON)
                            .content(json.writeValueAsBytes(p)))
                    .andExpect(status().is(config == externa ? 404 : 409));
        }
        assertThat(pagamentos.count()).isZero(); assertThat(financeiro.count()).isZero();
        assertThat(movimentos.count()).isZero(); assertThat(movimentosCaixa.count()).isZero();
        assertThat(vendas.count()).isEqualTo(aberta ? 1 : 0);
        if (aberta) assertThat(vendas.findById(id).orElseThrow().getStatus()).isEqualTo(StatusVenda.ABERTA);
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
    }

    @Test void faturamentoAbertoAceitaMesmoTipoDeOutroRegistroGlobalEPreservaNoCancelamento() throws Exception {
        var forma = catalogo.saveAndFlush(new FormaPagamentoEntity("Dinheiro alternativo", TipoFormaPagamento.DINHEIRO, true));
        var config = configuracao(empresa, forma.getId(), true);
        long id = abrir(); adicionar(id, produto.getId(), 2);
        var p = pagamento(); p.put("configuracaoFormaPagamentoId", config.getId());
        for (int tentativa = 0; tentativa < 2; tentativa++) {
            mvc.perform(post("/vendas/" + id + "/faturar").header(HttpHeaders.AUTHORIZATION, authorization)
                            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(p)))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.configuracaoFormaPagamentoId").value(config.getId()));
        }
        p.put("configuracaoFormaPagamentoId", configuracao(empresa, 1, true).getId());
        mvc.perform(post("/vendas/" + id + "/faturar").header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(p)))
                .andExpect(status().isConflict());
        jdbc.update("update configuracoes_formas_pagamento_empresa set ativo=false where id=?", config.getId());
        for (int tentativa = 0; tentativa < 2; tentativa++)
            mvc.perform(post("/vendas/" + id + "/cancelar").header(HttpHeaders.AUTHORIZATION, authorization))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.configuracaoFormaPagamentoId").value(config.getId()));
        mvc.perform(get("/vendas/" + id + "/pagamentos").header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].status").value("CANCELADO"))
                .andExpect(jsonPath("$[0].configuracaoFormaPagamentoId").value(config.getId()))
                .andExpect(jsonPath("$[0].configuracaoNomeExibicao").value(config.getNomeExibicao()))
                .andExpect(jsonPath("$[0].configuracaoTipo").value("DINHEIRO"))
                .andExpect(jsonPath("$[0].configuracaoContaFinanceiraDestinoId").doesNotExist())
                .andExpect(jsonPath("$[0].configuracaoContaFinanceiraDestinoNome").doesNotExist());
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
        assertThat(movimentosCaixa.count()).isEqualTo(2);
        assertThat(pagamentos.count()).isEqualTo(1);
        String outroToken = br.com.novexa.erp.support.AutenticacaoTeste.token(usuarios, jwt, outra, PerfilUsuario.USUARIO, "52998224725");
        mvc.perform(get("/vendas/" + id).header(HttpHeaders.AUTHORIZATION, outroToken)).andExpect(status().isNotFound());
        mvc.perform(get("/vendas/" + id + "/pagamentos").header(HttpHeaders.AUTHORIZATION, outroToken)).andExpect(status().isNotFound());
    }

    @Test void vendaGlobalSemConfiguracaoContinuaLegivel() throws Exception {
        var p = pedido(); p.remove("formaPagamento"); p.put("formaPagamentoId", 2L);
        var config = configuracao(empresa, 2, true);
        p.put("configuracaoFormaPagamentoId", config.getId());
        long id = enviar(p);
        jdbc.update("update pagamentos set configuracao_forma_pagamento_id=null, configuracao_nome_exibicao=null, configuracao_tipo=null, configuracao_conta_financeira_destino_id=null, configuracao_conta_financeira_destino_nome=null where venda_id=?", id);
        jdbc.update("update vendas set configuracao_forma_pagamento_id=null where id=?", id);
        mvc.perform(get("/vendas/" + id).header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.configuracaoFormaPagamentoId").doesNotExist());
        mvc.perform(get("/vendas/" + id + "/pagamentos").header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].configuracaoFormaPagamentoId").doesNotExist())
                .andExpect(jsonPath("$[0].formaPagamentoId").value(2))
                .andExpect(jsonPath("$[0].configuracaoNomeExibicao").doesNotExist())
                .andExpect(jsonPath("$[0].configuracaoTipo").doesNotExist())
                .andExpect(jsonPath("$[0].configuracaoContaFinanceiraDestinoId").doesNotExist())
                .andExpect(jsonPath("$[0].configuracaoContaFinanceiraDestinoNome").doesNotExist());
    }

    @ParameterizedTest @ValueSource(ints = {4, 150})
    void snapshotPixPreservaNomeEDestinoOriginaisAposEdicaoRetryECancelamento(int tamanhoNome) throws Exception {
        var config = configuracao(empresa, 2, true);
        var itau = config.getContaFinanceiraDestino();
        String nomeOriginal = "Itaú" + "x".repeat(tamanhoNome - 4);
        itau.editar(nomeOriginal, TipoContaFinanceira.BANCO); contasFinanceiras.saveAndFlush(itau);
        config.atualizar("PIX Itaú", true, itau); configuracoes.saveAndFlush(config);
        var p = pedido(); p.remove("formaPagamento"); p.put("formaPagamentoId", 2L);
        p.put("configuracaoFormaPagamentoId", config.getId());
        long vendaId = enviar(p);
        var original = pagamentos.findAll().getFirst();
        assertThat(original.getConfiguracaoNomeExibicao()).isEqualTo("PIX Itaú");
        assertThat(original.getConfiguracaoTipo()).isEqualTo(TipoFormaPagamento.PIX);
        assertThat(original.getConfiguracaoContaFinanceiraDestinoId()).isEqualTo(itau.getId());
        assertThat(original.getConfiguracaoContaFinanceiraDestinoNome()).isEqualTo(nomeOriginal);

        var nubank = contasFinanceiras.saveAndFlush(new ContaFinanceiraEntity(empresa, "Nubank", TipoContaFinanceira.BANCO, BigDecimal.ZERO));
        mvc.perform(put("/financeiro/configuracoes-formas-pagamento/" + config.getId()).header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of(
                                "formaPagamentoId", 2, "nomeExibicao", "PIX Nubank", "contaFinanceiraDestinoId", nubank.getId()))))
                .andExpect(status().isOk());
        itau.editar("Itaú renomeado", TipoContaFinanceira.BANCO); contasFinanceiras.saveAndFlush(itau);
        for (int retry = 0; retry < 2; retry++) assertThat(enviar(p)).isEqualTo(vendaId);
        mvc.perform(post("/vendas/" + vendaId + "/cancelar").header(HttpHeaders.AUTHORIZATION, authorization)).andExpect(status().isOk());
        mvc.perform(get("/vendas/" + vendaId + "/pagamentos").header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(original.getId()))
                .andExpect(jsonPath("$[0].status").value("CANCELADO"))
                .andExpect(jsonPath("$[0].configuracaoNomeExibicao").value("PIX Itaú"))
                .andExpect(jsonPath("$[0].configuracaoTipo").value("PIX"))
                .andExpect(jsonPath("$[0].configuracaoContaFinanceiraDestinoId").value(itau.getId()))
                .andExpect(jsonPath("$[0].configuracaoContaFinanceiraDestinoNome").value(nomeOriginal));
        assertThat(pagamentos.count()).isEqualTo(1);
        assertThat(contasFinanceiras.findById(itau.getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo("100");
        assertThat(contasFinanceiras.findById(nubank.getId()).orElseThrow().getSaldoAtual()).isZero();
    }

    @ParameterizedTest @ValueSource(booleans = {false, true})
    void confirmacaoPixUsaSnapshotMesmoAposTrocaDeDestinoEInativacao(boolean inativarConta) throws Exception {
        var config = configuracao(empresa, 2, true);
        Long contaOriginal = config.getContaFinanceiraDestino().getId();
        long vendaId = vendaConfigurada(config, 2);
        long pagamentoId = pagamentos.findAll().getFirst().getId();
        assertThat(movimentosFinanceiros.count()).isZero();
        mvc.perform(get("/vendas/" + vendaId + "/pagamentos").header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(jsonPath("$[0].confirmadoFinanceiramente").value(false));
        var novaConta = contasFinanceiras.saveAndFlush(new ContaFinanceiraEntity(empresa, "Novo destino", TipoContaFinanceira.CARTEIRA_DIGITAL, BigDecimal.ZERO));
        config.atualizar("PIX alterado", false, novaConta); configuracoes.saveAndFlush(config);
        if (inativarConta) jdbc.update("update contas_financeiras set ativo=false where id=?", contaOriginal);
        var primeira = confirmarPix(pagamentoId, authorization).andExpect(status().isOk())
                .andExpect(jsonPath("$.confirmadoFinanceiramente").value(true))
                .andExpect(jsonPath("$.usuarioConfirmacaoFinanceiraId").value(operador.getId()))
                .andExpect(jsonPath("$.dataConfirmacaoFinanceira").isNotEmpty())
                .andExpect(jsonPath("$.movimentacaoFinanceiraId").isNumber()).andReturn().getResponse().getContentAsString();
        String outroOperador = tokenAdminSegundo();
        var segunda = confirmarPix(pagamentoId, outroOperador).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(segunda)).isEqualTo(json.readTree(primeira));
        assertThat(contasFinanceiras.findById(contaOriginal).orElseThrow().getSaldoAtual()).isEqualByComparingTo("120");
        assertThat(contasFinanceiras.findById(novaConta.getId()).orElseThrow().getSaldoAtual()).isZero();
        var movimento = movimentosFinanceiros.findAll().getFirst();
        assertThat(movimentosFinanceiros.count()).isEqualTo(1);
        assertThat(movimento.getTipo()).isEqualTo(TipoMovimentacaoFinanceira.ENTRADA);
        assertThat(movimento.getOrigem()).isEqualTo(OrigemMovimentacaoFinanceira.PAGAMENTO_PIX);
        assertThat(movimento.getPagamento().getId()).isEqualTo(pagamentoId);
        assertThat(movimento.getContaFinanceira().getId()).isEqualTo(contaOriginal);
        assertThat(movimento.getValor()).isEqualByComparingTo("20");
        mvc.perform(get("/vendas/" + vendaId + "/pagamentos").header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(jsonPath("$[0].movimentacaoFinanceiraId").value(movimento.getId()))
                .andExpect(jsonPath("$[0].confirmadoFinanceiramente").value(true));
        assertThat(movimentosCaixa.count()).isZero();
        assertThat(financeiro.count()).isZero();
    }

    @ParameterizedTest @ValueSource(longs = {1, 3, 4})
    void confirmacaoPixRejeitaOutrosTipos(long forma) throws Exception {
        vendaConfigurada(configuracao(empresa, forma, true), forma);
        confirmarPix(pagamentos.findAll().getFirst().getId(), authorization).andExpect(status().isConflict());
        assertThat(movimentosFinanceiros.count()).isZero();
    }

    @ParameterizedTest @ValueSource(strings = {"ADMIN", "GERENTE", "OPERADOR", "USUARIO"})
    void confirmacaoPixRespeitaPerfil(String perfil) throws Exception {
        var config = configuracao(empresa, 2, true);
        vendaConfigurada(config, 2);
        long pagamento = pagamentos.findAll().getFirst().getId();
        segundo.setPerfil(PerfilUsuario.valueOf(perfil));
        segundo = usuarios.saveAndFlush(segundo);
        var resposta = confirmarPix(pagamento, "Bearer " + jwt.gerarToken(segundo));
        boolean autorizado = perfil.equals("ADMIN") || perfil.equals("GERENTE");
        resposta.andExpect(autorizado ? status().isOk() : status().isForbidden());
        assertThat(movimentosFinanceiros.count()).isEqualTo(autorizado ? 1 : 0);
        assertThat(contasFinanceiras.findById(config.getContaFinanceiraDestino().getId()).orElseThrow().getSaldoAtual())
                .isEqualByComparingTo(autorizado ? "120" : "100");
    }

    @Test void confirmacaoPixExigeAutenticacao() throws Exception {
        vendaConfigurada(configuracao(empresa, 2, true), 2);
        mvc.perform(post("/financeiro/pagamentos/" + pagamentos.findAll().getFirst().getId() + "/confirmar-recebimento"))
                .andExpect(status().isUnauthorized());
        assertThat(movimentosFinanceiros.count()).isZero();
    }

    @Test void confirmacaoPixSemSnapshotNaoUsaConfiguracaoAtual() throws Exception {
        var config = configuracao(empresa, 2, true);
        vendaConfigurada(config, 2);
        long pagamento = pagamentos.findAll().getFirst().getId();
        jdbc.update("update pagamentos set configuracao_conta_financeira_destino_id=null where id=?", pagamento);
        confirmarPix(pagamento, authorization).andExpect(status().isConflict());
        assertThat(movimentosFinanceiros.count()).isZero();
        assertThat(contasFinanceiras.findById(config.getContaFinanceiraDestino().getId()).orElseThrow().getSaldoAtual())
                .isEqualByComparingTo("100");
    }

    @Test void confirmacaoPixRejeitaCanceladoEOutroTenant() throws Exception {
        var config = configuracao(empresa, 2, true);
        long vendaId = vendaConfigurada(config, 2);
        long pagamentoId = pagamentos.findAll().getFirst().getId();
        String externo = br.com.novexa.erp.support.AutenticacaoTeste.token(usuarios, jwt, outra, PerfilUsuario.ADMIN, "52998224725");
        confirmarPix(pagamentoId, externo).andExpect(status().isNotFound());
        mvc.perform(post("/vendas/" + vendaId + "/cancelar").header(HttpHeaders.AUTHORIZATION, authorization)).andExpect(status().isOk());
        confirmarPix(pagamentoId, authorization).andExpect(status().isConflict());
        assertThat(movimentosFinanceiros.count()).isZero();
        assertThat(contasFinanceiras.findById(config.getContaFinanceiraDestino().getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo("100");
    }

    @Test void confirmacaoPixRejeitaDestinoAusenteOuDeOutroTenant() throws Exception {
        var config = configuracao(empresa, 2, true);
        vendaConfigurada(config, 2);
        long id = pagamentos.findAll().getFirst().getId();
        jdbc.update("update pagamentos set configuracao_conta_financeira_destino_id=null where id=?", id);
        confirmarPix(id, authorization).andExpect(status().isConflict());
        var externa = contasFinanceiras.saveAndFlush(new ContaFinanceiraEntity(outra, "Externa", TipoContaFinanceira.BANCO, BigDecimal.ZERO));
        jdbc.update("update pagamentos set configuracao_conta_financeira_destino_id=? where id=?", externa.getId(), id);
        confirmarPix(id, authorization).andExpect(status().isNotFound());
        assertThat(movimentosFinanceiros.count()).isZero();
    }

    @ParameterizedTest @ValueSource(ints = {0, -1})
    void confirmacaoPixRejeitaValorInvalido(int valor) throws Exception {
        vendaConfigurada(configuracao(empresa, 2, true), 2);
        long id = pagamentos.findAll().getFirst().getId();
        jdbc.update("update pagamentos set valor=? where id=?", valor, id);
        confirmarPix(id, authorization).andExpect(status().isConflict());
        assertThat(movimentosFinanceiros.count()).isZero();
    }

    @Test void confirmacaoPixFalhaDePersistenciaReverteSaldoEMovimento() throws Exception {
        var config = configuracao(empresa, 2, true);
        vendaConfigurada(config, 2);
        long id = pagamentos.findAll().getFirst().getId();
        doAnswer(invocation -> {
            movimentosFinanceiros.save(invocation.getArgument(0));
            movimentosFinanceiros.flush();
            throw new IllegalStateException("falha persistencia PIX");
        }).when(movimentosFinanceiros).saveAndFlush(any(MovimentacaoFinanceiraEntity.class));
        confirmarPix(id, authorization).andExpect(status().isInternalServerError());
        assertThat(movimentosFinanceiros.count()).isZero();
        assertThat(contasFinanceiras.findById(config.getContaFinanceiraDestino().getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo("100");
        reset(movimentosFinanceiros);
        confirmarPix(id, authorization).andExpect(status().isOk());
        assertThat(movimentosFinanceiros.count()).isEqualTo(1);
        assertThat(contasFinanceiras.findById(config.getContaFinanceiraDestino().getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo("120");
    }

    @ParameterizedTest @ValueSource(booleans = {false, true})
    void cicloPixCancelamentoPreservaHistoricoEAuditoria(boolean inativa) throws Exception {
        var config = configuracao(empresa, 2, true);
        long venda = vendaConfigurada(config, 2);
        long pagamento = pagamentos.findAll().getFirst().getId();
        confirmarPix(pagamento, authorization).andExpect(status().isOk());
        var original = movimentosFinanceiros.findAll().getFirst();
        if (inativa) jdbc.update("update contas_financeiras set ativo=false where id=?", config.getContaFinanceiraDestino().getId());
        cancelarPix(venda).andExpect(status().isOk());
        var estornado = movimentosFinanceiros.findById(original.getId()).orElseThrow();
        assertThat(estornado.isEstornada()).isTrue();
        assertThat(estornado.getDataEstorno()).isNotNull();
        assertThat(estornado.getUsuarioEstorno().getId()).isEqualTo(operador.getId());
        assertThat(estornado.getMotivoEstorno()).isEqualTo("Cancelamento da venda " + venda);
        cancelarPix(venda).andExpect(status().isOk());
        var retry = movimentosFinanceiros.findById(original.getId()).orElseThrow();
        assertThat(retry.getDataEstorno()).isEqualTo(estornado.getDataEstorno());
        assertThat(retry.getDataCriacao()).isEqualTo(original.getDataCriacao());
        assertThat(movimentosFinanceiros.count()).isEqualTo(1);
        assertThat(pagamentos.findById(pagamento).orElseThrow().getStatus()).isEqualTo(StatusPagamento.CANCELADO);
        assertThat(contasFinanceiras.findById(config.getContaFinanceiraDestino().getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo("100");
        confirmarPix(pagamento, authorization).andExpect(status().isConflict());
    }

    @Test void cicloPixFalhaNoCancelamentoReverteTodosEfeitos() throws Exception {
        var config = configuracao(empresa, 2, true);
        long venda = vendaConfigurada(config, 2);
        confirmarPix(pagamentos.findAll().getFirst().getId(), authorization).andExpect(status().isOk());
        doAnswer(invocation -> {
            movimentosFinanceiros.save(invocation.getArgument(0)); movimentosFinanceiros.flush();
            throw new IllegalStateException("falha estorno PIX");
        }).when(movimentosFinanceiros).saveAndFlush(any(MovimentacaoFinanceiraEntity.class));
        cancelarPix(venda).andExpect(status().isInternalServerError());
        assertThat(vendas.findById(venda).orElseThrow().getStatus()).isEqualTo(StatusVenda.FATURADA);
        assertThat(pagamentos.findAll().getFirst().getStatus()).isEqualTo(StatusPagamento.REGISTRADO);
        assertThat(movimentosFinanceiros.findAll().getFirst().isEstornada()).isFalse();
        assertThat(movimentosFinanceiros.findAll().getFirst().getDataEstorno()).isNull();
        assertThat(contasFinanceiras.findById(config.getContaFinanceiraDestino().getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo("120");
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("8");
        assertThat(movimentos.count()).isEqualTo(1);
        reset(movimentosFinanceiros);
        cancelarPix(venda).andExpect(status().isOk());
    }

    @Test void cicloPixSaldoInsuficienteImpedeCancelamentoIntegral() throws Exception {
        var config = configuracao(empresa, 2, true);
        long venda = vendaConfigurada(config, 2);
        confirmarPix(pagamentos.findAll().getFirst().getId(), authorization).andExpect(status().isOk());
        jdbc.update("update contas_financeiras set saldo_atual=10 where id=?", config.getContaFinanceiraDestino().getId());
        cancelarPix(venda).andExpect(status().isConflict());
        assertThat(vendas.findById(venda).orElseThrow().getStatus()).isEqualTo(StatusVenda.FATURADA);
        assertThat(pagamentos.findAll().getFirst().getStatus()).isEqualTo(StatusPagamento.REGISTRADO);
        assertThat(movimentosFinanceiros.findAll().getFirst().isEstornada()).isFalse();
        assertThat(contasFinanceiras.findById(config.getContaFinanceiraDestino().getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo("10");
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("8");
    }

    @Test void cicloPixBloqueiaEstornoIndividual() throws Exception {
        long venda = vendaConfigurada(configuracao(empresa, 2, true), 2);
        confirmarPix(pagamentos.findAll().getFirst().getId(), authorization).andExpect(status().isOk());
        long movimento = movimentosFinanceiros.findAll().getFirst().getId();
        mvc.perform(patch("/financeiro/movimentacoes-financeiras/" + movimento + "/estorno")
                .header(HttpHeaders.AUTHORIZATION, authorization).contentType(MediaType.APPLICATION_JSON)
                .content("{\"motivoEstorno\":\"Estorno isolado\"}")).andExpect(status().isConflict());
        assertThat(movimentosFinanceiros.findById(movimento).orElseThrow().isEstornada()).isFalse();
        assertThat(vendas.findById(venda).orElseThrow().getStatus()).isEqualTo(StatusVenda.FATURADA);
    }

    @Test void cicloPixDuplaConfirmacaoConcorrente() throws Exception {
        var config = configuracao(empresa, 2, true);
        vendaConfigurada(config, 2);
        long pagamento = pagamentos.findAll().getFirst().getId();
        var outroToken = tokenAdminSegundo();
        var respostas = simultaneas(
                () -> confirmarPix(pagamento, authorization).andReturn().getResponse().getStatus(),
                () -> confirmarPix(pagamento, outroToken).andReturn().getResponse().getStatus());
        assertThat(respostas).containsExactly(200, 200);
        assertThat(movimentosFinanceiros.count()).isEqualTo(1);
        assertThat(contasFinanceiras.findById(config.getContaFinanceiraDestino().getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo("120");
    }

    @Test
    void dinheiroSemSessaoDoOperadorBloqueiaMesmoComCaixaDeOutroOperador() throws Exception {
        fecharCaixa(operador);
        mvc.perform(post("/vendas").header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(pedido())))
                .andExpect(status().isConflict()).andExpect(content().string(org.hamcrest.Matchers.containsString("Abra uma sessão de Caixa")));
        assertThat(vendas.count()).isZero();
        assertThat(pagamentos.count()).isZero();
        assertThat(movimentosCaixa.count()).isZero();
        assertThat(movimentos.count()).isZero();
        assertThat(financeiro.count()).isZero();
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
    }

    @Test
    void caixaAbertoDeOutraEmpresaNaoAtendeVendaEmDinheiro() throws Exception {
        sessoes.deleteAllInBatch();
        abrirCaixa(usuario(outra, "52998224725"));
        var dados = pedido();
        dados.put("sessaoCaixaId", sessoes.findAll().getFirst().getId());
        dados.put("empresaId", outra.getId());
        assertThat(statusVenda(dados, authorization)).isEqualTo(404);
        assertThat(movimentosCaixa.count()).isZero();
        assertThat(pagamentos.count()).isZero();
    }

    @Test
    void maisDeUmaSessaoDoOperadorNaoEscolheDestinoArbitrario() throws Exception {
        abrirCaixa(operador);
        assertThat(statusVenda(pedido(), authorization)).isEqualTo(409);
        assertThat(movimentosCaixa.count()).isZero();
    }

    @Test
    void sessaoExplicitaDeOutroOperadorNaoPodeSerUsada() throws Exception {
        var dados = pedido();
        dados.put("sessaoCaixaId", sessaoOperador().getId());
        assertThat(statusVenda(dados, "Bearer " + jwt.gerarToken(segundo))).isEqualTo(403);
        assertThat(vendas.count()).isZero();
        assertThat(movimentosCaixa.count()).isZero();
        assertThat(pagamentos.count()).isZero();
        assertThat(movimentos.count()).isZero();
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
    }

    @Test
    void vendaAbertaSoExigeSessaoNoFaturamentoEDepoisPodeRepetirComCaixaFechado() throws Exception {
        sessoes.deleteAllInBatch();
        long id = abrir();
        adicionar(id, produto.getId(), 2);
        var dados = pagamento();
        mvc.perform(post("/vendas/" + id + "/faturar").header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dados)))
                .andExpect(status().isConflict());
        assertThat(vendas.findById(id).orElseThrow().getStatus()).isEqualTo(StatusVenda.ABERTA);
        assertThat(pagamentos.count()).isZero();
        var sessao = abrirCaixa(operador);
        for (int tentativa = 0; tentativa < 2; tentativa++) {
            mvc.perform(post("/vendas/" + id + "/faturar").header(HttpHeaders.AUTHORIZATION, authorization)
                    .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dados)))
                    .andExpect(status().isOk());
            if (tentativa == 0) fecharCaixa(operador);
        }
        assertThat(movimentosCaixa.count()).isEqualTo(1);
        assertThat(movimentosCaixa.findAll().getFirst().getSessao().getId()).isEqualTo(sessao.id());
        assertThat(pagamentos.count()).isEqualTo(1);
    }

    @Test
    void falhaAoPersistirMovimentoCaixaReverteTodoFaturamento() throws Exception {
        long id = abrir(); adicionar(id, produto.getId(), 2);
        doAnswer(invocation -> {
            movimentosCaixa.save(invocation.getArgument(0));
            movimentosCaixa.flush();
            assertThat(movimentosCaixa.count()).isEqualTo(1);
            throw new IllegalStateException("falha posterior à entrada de caixa");
        }).when(movimentosCaixa).saveAndFlush(any(MovimentacaoCaixaEntity.class));
        assertThat(faturarStatus(id, authorization)).isEqualTo(500);
        assertThat(movimentosCaixa.count()).isZero();
        assertThat(pagamentos.count()).isZero();
        assertThat(financeiro.count()).isZero();
        assertThat(movimentos.count()).isZero();
        assertThat(vendas.findById(id).orElseThrow().getStatus()).isEqualTo(StatusVenda.ABERTA);
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
    }

    @Test
    @Disabled("Requer PostgreSQL para validar comportamento de lock concorrente; H2 não garante ordenação determinística")
    void vendaConfirmaEntradaAntesDeFechamentoConcorrente() throws Exception {
        var sessao = sessaoOperador();
        segundo.setPerfil(PerfilUsuario.GERENTE);
        segundo = usuarios.saveAndFlush(segundo);
        var gravou = new CountDownLatch(1); var liberar = new CountDownLatch(1);
        doAnswer(invocation -> {
            var salvo = movimentosCaixa.save(invocation.getArgument(0));
            movimentosCaixa.flush();
            gravou.countDown();
            assertThat(liberar.await(10, TimeUnit.SECONDS)).isTrue();
            return salvo;
        }).when(movimentosCaixa).saveAndFlush(any(MovimentacaoCaixaEntity.class));
        try (var pool = Executors.newFixedThreadPool(2)) {
            var venda = pool.submit(() -> enviar(pedido()));
            Future<?> fechamento;
            try {
                assertThat(gravou.await(10, TimeUnit.SECONDS)).isTrue();
                fechamento = pool.submit(() -> sessaoService.fechar(sessao.getCaixa().getId(), sessao.getId(),
                        new BigDecimal("20"), principal(segundo)));
                assertThatThrownBy(() -> fechamento.get(200, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
            } finally { liberar.countDown(); }
            assertThat(venda.get(15, TimeUnit.SECONDS)).isNotNull();
            fechamento.get(15, TimeUnit.SECONDS);
        }
        assertThat(movimentosCaixa.count()).isEqualTo(1);
        assertThat(sessoes.findById(sessao.getId()).orElseThrow().getStatus()).isEqualTo(StatusSessaoCaixa.FECHADO);
    }

    @Test
    @Disabled("Requer PostgreSQL para validar comportamento de lock concorrente; H2 não garante ordenação determinística")
    void fechamentoConcorrentePrimeiroImpedeEntradaNaSessaoFechada() throws Exception {
        var sessao = sessaoOperador();
        segundo.setPerfil(PerfilUsuario.GERENTE);
        segundo = usuarios.saveAndFlush(segundo);
        var fechou = new CountDownLatch(1); var liberar = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var fechamento = pool.submit(() -> new org.springframework.transaction.support.TransactionTemplate(transactions).execute(s -> {
                var resultado = sessaoService.fechar(sessao.getCaixa().getId(), sessao.getId(), BigDecimal.ZERO, principal(segundo));
                fechou.countDown();
                try { assertThat(liberar.await(10, TimeUnit.SECONDS)).isTrue(); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); }
                return resultado;
            }));
            Future<Integer> venda;
            try {
                assertThat(fechou.await(10, TimeUnit.SECONDS)).isTrue();
                venda = pool.submit(() -> statusVenda(pedido(), authorization));
                assertThatThrownBy(() -> venda.get(200, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
            } finally { liberar.countDown(); }
            fechamento.get(15, TimeUnit.SECONDS);
            assertThat(venda.get(15, TimeUnit.SECONDS)).isEqualTo(409);
        }
        assertThat(movimentosCaixa.count()).isZero();
        assertThat(pagamentos.count()).isZero();
        assertThat(vendas.count()).isZero();
        assertThat(movimentos.count()).isZero();
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
    }

    private br.com.novexa.erp.security.UsuarioAutenticado principal(UsuarioEntity u) {
        return new br.com.novexa.erp.security.UsuarioAutenticado(u.getId(), u.getCpf(), u.getEmpresa().getId(), u.getPerfil());
    }
    private br.com.novexa.erp.dto.SessaoCaixaResponseDTO abrirCaixa(UsuarioEntity u) {
        var caixa = new CaixaEntity(); caixa.setEmpresa(u.getEmpresa()); caixa.setDescricao("Caixa " + UUID.randomUUID());
        caixas.saveAndFlush(caixa);
        return sessaoService.abrir(caixa.getId(), BigDecimal.ZERO, principal(u));
    }
    private SessaoCaixaEntity sessaoOperador() {
        return sessoes.findByEmpresaIdAndUsuarioAberturaIdAndStatus(empresa.getId(), operador.getId(), StatusSessaoCaixa.ABERTO).getFirst();
    }
    private void fecharCaixa(UsuarioEntity u) {
        var sessao = sessoes.findByEmpresaIdAndUsuarioAberturaIdAndStatus(u.getEmpresa().getId(), u.getId(), StatusSessaoCaixa.ABERTO).getFirst();
        sessaoService.fechar(sessao.getCaixa().getId(), sessao.getId(), BigDecimal.ZERO, principal(u));
    }

    @Test void cicloPixConfirmacaoECancelamentoConcorrentes() throws Exception {
        var config = configuracao(empresa, 2, true);
        long venda = vendaConfigurada(config, 2);
        long pagamento = pagamentos.findAll().getFirst().getId();
        var outroToken = tokenAdminSegundo();
        var respostas = simultaneas(
                () -> confirmarPix(pagamento, outroToken).andReturn().getResponse().getStatus(),
                () -> cancelarPix(venda).andReturn().getResponse().getStatus());
        assertThat(respostas.get(0)).isIn(200, 409);
        assertThat(respostas.get(1)).isEqualTo(200);
        assertThat(vendas.findById(venda).orElseThrow().getStatus()).isEqualTo(StatusVenda.CANCELADA);
        assertThat(pagamentos.findById(pagamento).orElseThrow().getStatus()).isEqualTo(StatusPagamento.CANCELADO);
        assertThat(movimentosFinanceiros.count()).isEqualTo(respostas.get(0) == 200 ? 1 : 0);
        assertThat(movimentosFinanceiros.findAll()).allMatch(MovimentacaoFinanceiraEntity::isEstornada);
        assertThat(contasFinanceiras.findById(config.getContaFinanceiraDestino().getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo("100");
    }

    private List<Integer> simultaneas(Callable<Integer> a, Callable<Integer> b) throws Exception {
        var inicio = new CountDownLatch(1);
        var prontas = new CountDownLatch(2);
        var pool = Executors.newFixedThreadPool(2);
        try {
            var primeira = pool.submit(() -> { prontas.countDown(); inicio.await(); return a.call(); });
            var segunda = pool.submit(() -> { prontas.countDown(); inicio.await(); return b.call(); });
            assertThat(prontas.await(5, TimeUnit.SECONDS)).isTrue(); inicio.countDown();
            return List.of(primeira.get(20, TimeUnit.SECONDS), segunda.get(20, TimeUnit.SECONDS));
        } finally { inicio.countDown(); pool.shutdownNow(); pool.awaitTermination(5, TimeUnit.SECONDS); }
    }

    private org.springframework.test.web.servlet.ResultActions cancelarPix(long venda) throws Exception {
        return mvc.perform(post("/vendas/" + venda + "/cancelar").header(HttpHeaders.AUTHORIZATION, authorization));
    }

    private long vendaConfigurada(ConfiguracaoFormaPagamentoEmpresaEntity config, long forma) throws Exception {
        var p = pedido(); p.remove("formaPagamento"); p.put("formaPagamentoId", forma);
        p.put("configuracaoFormaPagamentoId", config.getId()); return enviar(p);
    }
    private org.springframework.test.web.servlet.ResultActions confirmarPix(long id, String auth) throws Exception {
        return mvc.perform(post("/financeiro/pagamentos/" + id + "/confirmar-recebimento").header(HttpHeaders.AUTHORIZATION, auth));
    }

    private String tokenAdminSegundo() {
        segundo.setPerfil(PerfilUsuario.ADMIN);
        segundo = usuarios.saveAndFlush(segundo);
        return "Bearer " + jwt.gerarToken(segundo);
    }

    private ConfiguracaoFormaPagamentoEmpresaEntity configuracao(EmpresaEntity e, long formaId, boolean ativo) {
        var forma = catalogo.findById(formaId).orElseThrow();
        var destino = forma.getTipo() == TipoFormaPagamento.PIX || forma.getTipo() == TipoFormaPagamento.DEBITO
                || forma.getTipo() == TipoFormaPagamento.CREDITO
                ? contasFinanceiras.saveAndFlush(new ContaFinanceiraEntity(e, "Banco", TipoContaFinanceira.BANCO, new BigDecimal("100"))) : null;
        return configuracoes.saveAndFlush(new ConfiguracaoFormaPagamentoEmpresaEntity(e, forma, "Forma " + UUID.randomUUID(), ativo, destino));
    }

    private long abrir() throws Exception {
        var result = mvc.perform(post("/vendas/abertas").header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("ABERTA"))
                .andExpect(jsonPath("$.itens").isEmpty()).andReturn();
        return json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    }

    private com.fasterxml.jackson.databind.JsonNode adicionar(long vendaId, long produtoId, int quantidade) throws Exception {
        var result = mvc.perform(post("/vendas/" + vendaId + "/itens").header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(Map.of("produtoId", produtoId, "quantidade", quantidade))))
                .andExpect(status().isOk()).andReturn();
        return json.readTree(result.getResponse().getContentAsString());
    }

    private Map<String, Object> pagamento() {
        return new HashMap<>(Map.of("chaveRequisicao", UUID.randomUUID(), "totalEsperado", 20,
                "formaPagamento", "DINHEIRO", "valorRecebido", 20));
    }

    private int faturarStatus(long id, String token) throws Exception {
        return mvc.perform(post("/vendas/" + id + "/faturar").header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(pagamento())))
                .andReturn().getResponse().getStatus();
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder operacao(
            long id, long itemId, String operacao) throws Exception {
        String url = "/vendas/" + id;
        return switch (operacao) {
            case "adicionar" -> post(url + "/itens").contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsBytes(Map.of("produtoId", produto.getId(), "quantidade", 1)));
            case "quantidade" -> patch(url + "/itens/" + itemId).contentType(MediaType.APPLICATION_JSON).content("{\"quantidade\":3}");
            case "remover" -> delete(url + "/itens/" + itemId);
            case "desconto" -> patch(url + "/desconto").contentType(MediaType.APPLICATION_JSON).content("{\"desconto\":1}");
            case "cliente" -> put(url + "/cliente").contentType(MediaType.APPLICATION_JSON).content("{\"clienteId\":1}");
            case "removerCliente" -> delete(url + "/cliente");
            case "faturar" -> post(url + "/faturar").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(pagamento()));
            case "buscar" -> get(url);
            default -> throw new IllegalArgumentException(operacao);
        };
    }

    private int statusVenda(Map<String, Object> pedido, String token) throws Exception {
        return mvc.perform(post("/vendas").header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(pedido))).andReturn().getResponse().getStatus();
    }
    private long enviar(Map<String, Object> pedido) throws Exception {
        var resposta = mvc.perform(post("/vendas").header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(pedido))).andExpect(status().isCreated()).andReturn();
        return json.readTree(resposta.getResponse().getContentAsString()).get("id").asLong();
    }
    private Map<String, Object> item() { return Map.of("produtoId", produto.getId(), "quantidade", 2, "precoUnitarioEsperado", 10); }
    private Map<String, Object> pedido() {
        return new HashMap<>(Map.of("chaveRequisicao", UUID.randomUUID(), "itens", List.of(item()), "desconto", 0,
                "totalEsperado", 20, "formaPagamento", "DINHEIRO", "valorRecebido", 20));
    }
    private EmpresaEntity empresa(String nome, String cnpj) {
        var e = new EmpresaEntity(); e.setRazaoSocial(nome); e.setCnpj(cnpj); e.setAtivo(true); return empresas.saveAndFlush(e);
    }
    private UsuarioEntity usuario(EmpresaEntity empresa, String cpf) {
        var u = new UsuarioEntity(); u.setEmpresa(empresa); u.setCpf(cpf); u.setNomeUsuario("Operador");
        u.setSenha("hash de teste"); u.setPerfil(PerfilUsuario.USUARIO); return usuarios.saveAndFlush(u);
    }
    private ProdutoEntity produto(EmpresaEntity empresa, String nome, String preco, String saldo) {
        var p = new ProdutoEntity(); p.setEmpresa(empresa); p.setNome(nome); p.setUnidadeMedida("UN");
        p.setPrecoVenda(new BigDecimal(preco)); p.setEstoqueAtual(new BigDecimal(saldo)); return produtos.saveAndFlush(p);
    }
}
