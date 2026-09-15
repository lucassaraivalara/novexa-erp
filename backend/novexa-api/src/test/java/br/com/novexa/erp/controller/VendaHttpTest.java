package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.service.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
    @Autowired MovimentacaoEstoqueRepository movimentos;
    @MockitoSpyBean LancamentoFinanceiroRepository financeiro;
    @MockitoSpyBean PagamentoRepository pagamentos;
    @Autowired JwtService jwt;
    EmpresaEntity empresa, outra;
    UsuarioEntity operador, segundo;
    ProdutoEntity produto;
    String authorization;

    @BeforeEach
    void preparar() {
        empresa = empresa("Empresa A", "11222333000181");
        outra = empresa("Empresa B", "12345678000190");
        operador = usuario(empresa, "02360684663");
        segundo = usuario(empresa, "11144477735");
        produto = produto(empresa, "Produto", "10.00", "10.000");
        authorization = "Bearer " + jwt.gerarToken(operador);
    }

    @AfterEach
    void limpar() {
        reset(financeiro, pagamentos);
        jdbc.update("delete from pagamentos");
        jdbc.update("delete from formas_pagamento");
        jdbc.update("delete from lancamentos_financeiros");
        jdbc.update("delete from itens_venda");
        jdbc.update("delete from vendas");
        movimentos.deleteAll();
        produtos.deleteAll();
        clientes.deleteAll();
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
        assertThat(financeiro.count()).isEqualTo(1);
        assertThat(pagamentos.count()).isEqualTo(1);
        assertThat(financeiro.findAll().getFirst().getValor()).isEqualByComparingTo("19");
        assertThat(financeiro.findAll().getFirst().getSituacao()).isEqualTo(LancamentoFinanceiroEntity.Situacao.RECEBIDO);
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
    @ValueSource(strings = {"PIX", "CARTAO_DEBITO", "CARTAO_CREDITO"})
    void registraFormaESituacaoFinanceira(String forma) throws Exception {
        var pedido = pedido(); pedido.put("formaPagamento", forma);
        enviar(pedido);
        assertThat(financeiro.findAll().getFirst().getSituacao()).isEqualTo(
                forma.equals("PIX") ? LancamentoFinanceiroEntity.Situacao.RECEBIDO : LancamentoFinanceiroEntity.Situacao.A_RECEBER);
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
    void falhaFinanceiraReverteVendaMovimentoESaldo() {
        doAnswer(invocation -> {
            assertThat(pagamentos.count()).isEqualTo(1);
            throw new IllegalStateException("falha simulada");
        }).when(financeiro).save(any());
        assertThatThrownBy(() -> enviar(pedido())).hasRootCauseMessage("falha simulada");
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
        assertThat(financeiro.findAll().getFirst().getValor()).isEqualByComparingTo("0.01");
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
        assertThat(financeiro.count()).isEqualTo(1);
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
        assertThat(financeiro.count()).isEqualTo(1);
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
        assertThat(financeiro.count()).isEqualTo(1);
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
            assertThat(pagamentos.count()).isEqualTo(1);
            throw new IllegalStateException("falha simulada");
        }).when(financeiro).save(any());
        var pagamento = pagamento();
        assertThatThrownBy(() -> mvc.perform(post("/vendas/" + id + "/faturar")
                .header(HttpHeaders.AUTHORIZATION, authorization).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(pagamento)))).hasRootCauseMessage("falha simulada");
        assertThat(vendas.findById(id).orElseThrow().getStatus()).isEqualTo(StatusVenda.ABERTA);
        assertThat(movimentos.count()).isZero();
        assertThat(financeiro.count()).isZero();
        assertThat(pagamentos.count()).isZero();
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
        assertThat(jdbc.queryForObject("select count(*) from itens_venda where movimentacao_estoque_id is not null", Long.class)).isZero();
        reset(financeiro);
        mvc.perform(post("/vendas/" + id + "/faturar").header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(pagamento)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("FATURADA"));
        assertThat(movimentos.count()).isEqualTo(1);
        assertThat(financeiro.count()).isEqualTo(1);
        assertThat(pagamentos.count()).isEqualTo(1);
    }

    @Test
    void doisOperadoresFaturandoMesmaVendaGeramUmUnicoEfeito() throws Exception {
        long id = abrir();
        adicionar(id, produto.getId(), 2);
        var primeiroPreparouLancamento = new CountDownLatch(1);
        var liberarPrimeiro = new CountDownLatch(1);
        var segundoIniciou = new CountDownLatch(1);
        doAnswer(invocation -> {
            LancamentoFinanceiroEntity salvo = financeiro.saveAndFlush(invocation.getArgument(0));
            primeiroPreparouLancamento.countDown();
            assertThat(liberarPrimeiro.await(10, TimeUnit.SECONDS)).isTrue();
            return salvo;
        }).when(financeiro).save(any(LancamentoFinanceiroEntity.class));
        try (var workers = Executors.newFixedThreadPool(2)) {
            var a = workers.submit(() -> faturarStatus(id, authorization));
            Future<Integer> b;
            try {
                assertThat(primeiroPreparouLancamento.await(10, TimeUnit.SECONDS)).isTrue();
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
        assertThat(financeiro.count()).isEqualTo(1);
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
        assertThatThrownBy(() -> mvc.perform(post("/vendas/" + id + "/faturar")
                .header(HttpHeaders.AUTHORIZATION, authorization).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(pagamento())))).hasRootCauseMessage("falha ao gravar pagamento");
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
        long id = enviar(pedido);
        var pagamento = pagamentos.findAll().getFirst();
        assertThat(pagamento.getForma().getId()).isEqualTo(formaId);
        assertThat(pagamento.getFormaPagamento().idPadrao()).isEqualTo(formaId);
        mvc.perform(get("/vendas/" + id + "/pagamentos").header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].formaPagamentoId").value(formaId))
                .andExpect(jsonPath("$[0].formaPagamento").value(pagamento.getFormaPagamento().name()));
        assertThat(financeiro.count()).isEqualTo(1);
        assertThat(movimentos.count()).isEqualTo(1);
    }

    @Test
    void formaCriadaPodeSerUsadaEHistoricoRetrySobrevivemAInativacao() throws Exception {
        var result = mvc.perform(post("/financeiro/formas-pagamento").header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON).content("{\"descricao\":\"PIX Alternativo\",\"tipo\":\"PIX\"}"))
                .andExpect(status().isCreated()).andReturn();
        long formaId = json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
        var pedido = pedido(); pedido.remove("formaPagamento"); pedido.put("formaPagamentoId", formaId);
        long id = enviar(pedido);
        mvc.perform(put("/financeiro/formas-pagamento/" + formaId).header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"descricao\":\"PIX renomeado\",\"tipo\":\"PIX\",\"ativo\":false}"))
                .andExpect(status().isOk());
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
        assertThat(financeiro.count()).isEqualTo(1);
        assertThat(movimentos.count()).isEqualTo(1);
    }

    @Test
    void inativacaoTambemBloqueiaCodigoLegadoEVendaAbertaSemEfeitos() throws Exception {
        mvc.perform(put("/financeiro/formas-pagamento/1").header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"descricao\":\"Dinheiro\",\"tipo\":\"DINHEIRO\",\"ativo\":false}"))
                .andExpect(status().isOk());
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
            var salvo = financeiro.saveAndFlush(invocation.getArgument(0));
            pagamentoGravado.countDown();
            assertThat(liberar.await(10, TimeUnit.SECONDS)).isTrue();
            return salvo;
        }).when(financeiro).save(any(LancamentoFinanceiroEntity.class));
        try (var workers = Executors.newFixedThreadPool(2)) {
            var venda = workers.submit(() -> enviar(pedido()));
            Future<Integer> inativacao;
            try {
                assertThat(pagamentoGravado.await(10, TimeUnit.SECONDS)).isTrue();
                inativacao = workers.submit(() -> {
                    inativacaoIniciou.countDown();
                    return mvc.perform(put("/financeiro/formas-pagamento/1").header(HttpHeaders.AUTHORIZATION, authorization)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"descricao\":\"Dinheiro\",\"tipo\":\"DINHEIRO\",\"ativo\":false}"))
                            .andReturn().getResponse().getStatus();
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
