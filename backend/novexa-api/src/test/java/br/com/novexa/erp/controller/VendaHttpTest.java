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
        reset(financeiro);
        jdbc.update("delete from lancamentos_financeiros");
        jdbc.update("delete from venda_itens");
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
        assertThat(financeiro.findAll().getFirst().getValor()).isEqualByComparingTo("19");
        assertThat(financeiro.findAll().getFirst().getSituacao()).isEqualTo(LancamentoFinanceiroEntity.Situacao.RECEBIDO);
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
        assertThat(movimentos.count()).isZero();
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual())
                .isEqualByComparingTo(caso.equals("estoque") ? "1" : "10");
    }

    @Test
    void falhaFinanceiraReverteVendaMovimentoESaldo() {
        doThrow(new IllegalStateException("falha simulada")).when(financeiro).save(any());
        assertThatThrownBy(() -> enviar(pedido())).hasRootCauseMessage("falha simulada");
        assertThat(vendas.count()).isZero();
        assertThat(financeiro.count()).isZero();
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
