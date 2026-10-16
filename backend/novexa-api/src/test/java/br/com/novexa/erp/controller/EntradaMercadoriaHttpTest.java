package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.service.*;
import br.com.novexa.erp.support.AutenticacaoTeste;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:entrada-http;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
        "spring.datasource.username=sa", "spring.datasource.password=", "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false", "spring.jpa.open-in-view=false",
        "spring.jpa.show-sql=false", "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=600000",
        "supabase.url=https://storage.test", "supabase.secret-key=synthetic-test-key", "supabase.bucket=produtos"
})
@AutoConfigureMockMvc
class EntradaMercadoriaHttpTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired FornecedorRepository fornecedores;
    @Autowired ProdutoRepository produtos;
    @MockitoSpyBean EntradaMercadoriaRepository entradas;
    @Autowired MovimentacaoEstoqueRepository movimentos;
    @Autowired ContaFinanceiraRepository contasFinanceirasTeste;
    @Autowired JwtService jwt;
    @MockitoSpyBean MovimentacaoEstoqueService estoque;
    EmpresaEntity empresa, outra;
    FornecedorEntity fornecedor, fornecedorB;
    ProdutoEntity produto, produto2, produtoB;
    String authorization, authorizationB;

    @BeforeEach void preparar() {
        empresa = empresa("A"); outra = empresa("B");
        authorization = AutenticacaoTeste.token(usuarios, jwt, empresa, PerfilUsuario.GERENTE, "02360684663");
        authorizationB = AutenticacaoTeste.token(usuarios, jwt, outra, PerfilUsuario.ADMIN, "11144477735");
        fornecedor = fornecedor(empresa, "ABC Distribuidora"); fornecedorB = fornecedor(outra, "Fornecedor B");
        produto = produto(empresa, "Produto A"); produto2 = produto(empresa, "Produto C"); produtoB = produto(outra, "Produto B");
    }
    @AfterEach void limpar() {
        reset(estoque);
        for (String tabela : List.of("itens_entrada_mercadoria", "entradas_mercadoria", "contas_pagar", "movimentacoes_caixa", "movimentacoes_financeiras", "contas_financeiras",
                "recebiveis", "pagamentos", "itens_venda", "vendas", "movimentacoes_estoque", "produtos", "fornecedores",
                "sessoes_caixa", "caixas", "usuario", "empresas")) jdbc.update("delete from " + tabela);
    }
    EmpresaEntity empresa(String nome) {
        var e = new EmpresaEntity(); e.setRazaoSocial(nome); e.setAtivo(true); return empresas.saveAndFlush(e);
    }
    FornecedorEntity fornecedor(EmpresaEntity e, String nome) {
        var f = new FornecedorEntity(); f.setEmpresa(e); f.setRazaoSocial(nome); return fornecedores.saveAndFlush(f);
    }
    ProdutoEntity produto(EmpresaEntity e, String nome) {
        var p = new ProdutoEntity(); p.setEmpresa(e); p.setNome(nome); p.setUnidadeMedida("UN");
        p.setPrecoVenda(new BigDecimal("10")); p.setPrecoCusto(new BigDecimal("2")); p.setEstoqueAtual(new BigDecimal("10"));
        return produtos.saveAndFlush(p);
    }
    Map<String, Object> item(ProdutoEntity p, String quantidade, String custo) {
        return new HashMap<>(Map.of("produtoId", p.getId(), "quantidade", quantidade, "valorUnitario", custo));
    }
    Map<String, Object> pedido() {
        return new HashMap<>(Map.of("fornecedorId", fornecedor.getId(), "dataEntrada", "2026-10-02",
                "itens", List.of(item(produto, "5", "3.50"))));
    }
    ResultActions criar(Map<String, Object> pedido) throws Exception { return criar(pedido, authorization); }
    ResultActions criar(Map<String, Object> pedido, String token) throws Exception {
        return mvc.perform(post("/estoque/entradas").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(pedido)));
    }
    long id(ResultActions r) throws Exception { return json.readTree(r.andReturn().getResponse().getContentAsString()).get("id").asLong(); }
    long criarEntrada() throws Exception { return id(criar(pedido()).andExpect(status().isCreated())); }
    ResultActions operacao(long id, String acao) throws Exception {
        return mvc.perform(post("/estoque/entradas/" + id + "/" + acao).header("Authorization", authorization));
    }
    ResultActions editar(long id, Map<String, Object> dados) throws Exception {
        return mvc.perform(put("/estoque/entradas/" + id).header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dados)));
    }
    BigDecimal saldo(ProdutoEntity p) { return produtos.findById(p.getId()).orElseThrow().getEstoqueAtual(); }

    ResultActions obrigacao(long entradaId, String acao, Object dados) throws Exception {
        return mvc.perform(post("/estoque/entradas/" + entradaId + "/conta-pagar/" + acao)
                .header("Authorization", authorization).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dados)));
    }
    Map<String, Object> geracao() {
        return Map.of("chaveRequisicao", UUID.randomUUID(), "descricao", "Obrigação da entrada", "valor", "65.25", "dataVencimento", "2026-12-10");
    }
    long confirmarNovaEntrada() throws Exception {
        long entradaId = criarEntrada(); operacao(entradaId, "confirmar").andExpect(status().isOk()); return entradaId;
    }
    long contaPreexistente() throws Exception {
        return id(mvc.perform(post("/financeiro/contas-pagar").header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("descricao", "Compra registrada",
                        "fornecedorId", fornecedor.getId(), "valor", "65.25", "dataVencimento", "2026-12-10"))))
                .andExpect(status().isCreated()));
    }

    @Test void historicoRastreiaConfirmacaoEReversaoSomentePorVinculoPersistidoEmLote() throws Exception {
        long entradaId = confirmarNovaEntrada();
        var confirmada = json.readTree(mvc.perform(get("/estoque/entradas/" + entradaId).header("Authorization", authorization))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        long originalId = confirmada.path("itens").get(0).path("movimentacaoEstoqueId").asLong();
        mvc.perform(get("/estoque/movimentacoes/produto/" + produto.getId()).header("Authorization", authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].entradaMercadoriaId").value(entradaId));
        long manualId = id(mvc.perform(post("/estoque/movimentacoes/entrada").header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("produtoId", produto.getId(),
                        "quantidade", 1, "motivo", "Entrada de mercadoria " + entradaId)))).andExpect(status().isCreated()));
        operacao(entradaId, "cancelar").andExpect(status().isOk());
        var cancelada = json.readTree(mvc.perform(get("/estoque/entradas/" + entradaId).header("Authorization", authorization))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        long reversaoId = cancelada.path("itens").get(0).path("movimentacaoCancelamentoId").asLong();
        long quantidadeMovimentos = movimentos.count();
        var custo = produtos.findById(produto.getId()).orElseThrow().getPrecoCusto();
        clearInvocations(entradas);
        mvc.perform(get("/estoque/movimentacoes/produto/" + produto.getId()).header("Authorization", authorization)
                .param("sort", "id,asc").param("size", "25"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(3))
                .andExpect(jsonPath("$.items[0].id").value(originalId)).andExpect(jsonPath("$.items[0].entradaMercadoriaId").value(entradaId))
                .andExpect(jsonPath("$.items[1].id").value(manualId)).andExpect(jsonPath("$.items[1].entradaMercadoriaId").isEmpty())
                .andExpect(jsonPath("$.items[2].id").value(reversaoId)).andExpect(jsonPath("$.items[2].entradaMercadoriaId").value(entradaId));
        verify(entradas, times(1)).buscarVinculosMovimentacoes(empresa.getId(), produto.getId(), List.of(originalId, manualId, reversaoId));
        mvc.perform(get("/estoque/movimentacoes/produto/" + produto.getId()).header("Authorization", authorization)
                .param("sort", "id,asc").param("size", "1").param("page", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(3)).andExpect(jsonPath("$.totalPages").value(3))
                .andExpect(jsonPath("$.items[0].id").value(manualId)).andExpect(jsonPath("$.items[0].entradaMercadoriaId").isEmpty());
        mvc.perform(get("/estoque/movimentacoes/produto/" + produto.getId()).header("Authorization", authorization)
                .param("origem", "CANCELAMENTO"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].entradaMercadoriaId").value(entradaId));
        mvc.perform(get("/estoque/movimentacoes/produto/" + produto.getId()).header("Authorization", authorizationB))
                .andExpect(status().isNotFound());
        assertThat(entradas.buscarVinculosMovimentacoes(outra.getId(), produto.getId(), List.of(originalId, reversaoId))).isEmpty();
        assertThat(entradas.buscarVinculosMovimentacoes(empresa.getId(), produto2.getId(), List.of(originalId, reversaoId))).isEmpty();
        assertThat(movimentos.count()).isEqualTo(quantidadeMovimentos);
        assertThat(saldo(produto)).isEqualByComparingTo("11");
        assertThat(produtos.findById(produto.getId()).orElseThrow().getPrecoCusto()).isEqualByComparingTo(custo);
    }

    @Test void obrigacaoExplicitaTemValorSeparadoERepeticaoNaoDuplicaNemMovimentaSaldo() throws Exception {
        long entradaId = confirmarNovaEntrada();
        mvc.perform(get("/estoque/entradas/" + entradaId + "/conta-pagar").header("Authorization", authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.conta").isEmpty());
        var pedido = geracao();
        var gerada = obrigacao(entradaId, "gerar", pedido).andExpect(status().isOk())
                .andExpect(jsonPath("$.origem").value("GERADA")).andExpect(jsonPath("$.conta.valor").value(65.25))
                .andExpect(jsonPath("$.conta.status").value("ABERTA")).andExpect(jsonPath("$.podeDesvincular").value(false));
        long contaId = json.readTree(gerada.andReturn().getResponse().getContentAsString()).path("conta").path("id").asLong();
        obrigacao(entradaId, "gerar", pedido).andExpect(status().isOk()).andExpect(jsonPath("$.conta.id").value(contaId));
        var alterado = new HashMap<>(pedido); alterado.put("valor", "66.00");
        obrigacao(entradaId, "gerar", alterado).andExpect(status().isConflict());
        obrigacao(entradaId, "gerar", geracao()).andExpect(status().isConflict());
        mvc.perform(get("/estoque/entradas/" + entradaId).header("Authorization", authorization))
                .andExpect(jsonPath("$.valorTotal").value(17.5));
        assertThat(jdbc.queryForObject("select count(*) from contas_pagar", Long.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from movimentacoes_financeiras", Long.class)).isZero();
        assertThat(saldo(produto)).isEqualByComparingTo("15");
    }

    @Test void cancelarEntradaCancelaSomenteContaGeradaAbertaERepeteSemNovoEfeito() throws Exception {
        long entradaId = confirmarNovaEntrada();
        var resposta = obrigacao(entradaId, "gerar", geracao()).andExpect(status().isOk());
        long contaId = json.readTree(resposta.andReturn().getResponse().getContentAsString()).path("conta").path("id").asLong();
        mvc.perform(post("/financeiro/contas-pagar/" + contaId + "/cancelar").header("Authorization", authorization)).andExpect(status().isConflict());
        obrigacao(entradaId, "desvincular", Map.of("contaPagarId", contaId)).andExpect(status().isConflict());
        operacao(entradaId, "cancelar").andExpect(status().isOk());
        operacao(entradaId, "cancelar").andExpect(status().isOk());
        mvc.perform(get("/financeiro/contas-pagar/" + contaId).header("Authorization", authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELADA"))
                .andExpect(jsonPath("$.entradaMercadoriaId").value(entradaId)).andExpect(jsonPath("$.origemVinculoEntrada").value("GERADA"));
        assertThat(saldo(produto)).isEqualByComparingTo("10");
        assertThat(jdbc.queryForObject("select count(*) from movimentacoes_financeiras", Long.class)).isZero();
    }

    @Test void contaPreexistenteRequerDesvinculacaoENuncaECanceladaPelaEntrada() throws Exception {
        long entradaId = confirmarNovaEntrada(), contaId = contaPreexistente();
        obrigacao(entradaId, "vincular", Map.of("contaPagarId", contaId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.origem").value("PREEXISTENTE")).andExpect(jsonPath("$.podeCancelarEntrada").value(false));
        obrigacao(entradaId, "vincular", Map.of("contaPagarId", contaId)).andExpect(status().isOk());
        operacao(entradaId, "cancelar").andExpect(status().isConflict());
        long outraEntrada = confirmarNovaEntrada();
        obrigacao(outraEntrada, "vincular", Map.of("contaPagarId", contaId)).andExpect(status().isConflict());
        obrigacao(entradaId, "desvincular", Map.of("contaPagarId", contaId)).andExpect(status().isOk());
        obrigacao(entradaId, "desvincular", Map.of("contaPagarId", contaId)).andExpect(status().isOk());
        operacao(entradaId, "cancelar").andExpect(status().isOk());
        mvc.perform(get("/financeiro/contas-pagar/" + contaId).header("Authorization", authorization))
                .andExpect(jsonPath("$.status").value("ABERTA")).andExpect(jsonPath("$.entradaMercadoriaId").isEmpty());
    }

    @Test void vincularPagaNaoRepetePagamentoEBloqueiaCancelamentoEDesvinculacao() throws Exception {
        long entradaId = confirmarNovaEntrada(), contaId = contaPreexistente();
        var financeiras = new ContaFinanceiraEntity(empresa, "Cofre teste", TipoContaFinanceira.COFRE, new BigDecimal("200"));
        // O pagamento real usa o fluxo financeiro existente; a vinculação não o executa novamente.
        financeiras = contasFinanceirasTeste.saveAndFlush(financeiras);
        mvc.perform(post("/financeiro/contas-pagar/" + contaId + "/pagar").header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("contaFinanceiraId", financeiras.getId(),
                        "valorPago", "65.25", "dataPagamento", "2026-10-15")))).andExpect(status().isOk());
        long movimentosAntes = jdbc.queryForObject("select count(*) from movimentacoes_financeiras", Long.class);
        obrigacao(entradaId, "vincular", Map.of("contaPagarId", contaId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.conta.status").value("PAGA")).andExpect(jsonPath("$.podeDesvincular").value(false));
        operacao(entradaId, "cancelar").andExpect(status().isConflict());
        obrigacao(entradaId, "desvincular", Map.of("contaPagarId", contaId)).andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("select count(*) from movimentacoes_financeiras", Long.class)).isEqualTo(movimentosAntes);
        assertThat(contasFinanceirasTeste.findById(financeiras.getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo("134.75");
        mvc.perform(post("/financeiro/contas-pagar/" + contaId + "/estornar").header("Authorization", authorization)).andExpect(status().isOk());
        obrigacao(entradaId, "desvincular", Map.of("contaPagarId", contaId)).andExpect(status().isOk());
    }

    @Test void obrigacaoRespeitaEstadoTenantEReverteCancelamentoSeEstoqueFalhar() throws Exception {
        long entradaId = criarEntrada();
        obrigacao(entradaId, "gerar", geracao()).andExpect(status().isConflict());
        mvc.perform(get("/estoque/entradas/" + entradaId + "/conta-pagar").header("Authorization", authorizationB)).andExpect(status().isNotFound());
        operacao(entradaId, "confirmar").andExpect(status().isOk());
        long contaOutra = id(mvc.perform(post("/financeiro/contas-pagar").header("Authorization", authorizationB)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("descricao", "Outra empresa",
                        "fornecedorId", fornecedorB.getId(), "valor", "65.25", "dataVencimento", "2026-12-10"))))
                .andExpect(status().isCreated()));
        obrigacao(entradaId, "vincular", Map.of("contaPagarId", contaOutra)).andExpect(status().isNotFound());
        obrigacao(entradaId, "gerar", geracao()).andExpect(status().isOk());
        var user = usuarios.findAll().stream().filter(u -> u.getEmpresa().getId().equals(empresa.getId())).findFirst().orElseThrow();
        estoque.movimentar(empresa.getId(), produto.getId(), user.getId(), TipoMovimentacaoEstoque.SAIDA,
                OrigemMovimentacaoEstoque.MANUAL, new BigDecimal("15"), "Consumo");
        operacao(entradaId, "cancelar").andExpect(status().isConflict());
        mvc.perform(get("/estoque/entradas/" + entradaId + "/conta-pagar").header("Authorization", authorization))
                .andExpect(jsonPath("$.conta.status").value("ABERTA"));
        assertThat(entradas.findById(entradaId).orElseThrow().getStatus()).isEqualTo(StatusEntradaMercadoria.CONFIRMADA);
    }

    @Test void criaRascunhoComTotaisCalculadosSemAlterarEstoqueCustoOuFinanceiro() throws Exception {
        var p = pedido(); p.put("valorTotal", 999); p.put("empresaId", outra.getId()); p.put("origem", "XML"); p.put("status", "CONFIRMADA");
        p.put("itens", List.of(item(produto, "1.125", "3.50"), item(produto2, "2", "0")));
        long id = id(criar(p).andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("RASCUNHO"))
                .andExpect(jsonPath("$.origem").value("MANUAL")).andExpect(jsonPath("$.valorProdutos").value(3.94))
                .andExpect(jsonPath("$.valorTotal").value(3.94)).andExpect(jsonPath("$.itens[0].valorTotal").value(3.94))
                .andExpect(jsonPath("$.itens[0].movimentacaoEstoqueId").isEmpty()));
        assertThat(entradas.findById(id).orElseThrow().getEmpresa().getId()).isEqualTo(empresa.getId());
        assertThat(saldo(produto)).isEqualByComparingTo("10"); assertThat(movimentos.count()).isZero();
        assertThat(produtos.findById(produto.getId()).orElseThrow().getPrecoCusto()).isEqualByComparingTo("2");
        assertThat(jdbc.queryForObject("select count(*) from contas_pagar", Long.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from movimentacoes_financeiras", Long.class)).isZero();
    }
    @Test void camposHistoricosEDataPadraoRetornamNoDetalhe() throws Exception {
        var p = pedido(); p.remove("dataEntrada"); p.put("numeroNota", " 100 "); p.put("serie", " 1 ");
        p.put("dataEmissao", "2026-10-01"); p.put("chaveAcessoNfe", "1".repeat(44)); p.put("observacao", "Recebimento");
        var i = item(produto, "1", "0"); i.putAll(Map.of("descricaoOriginal", "Descricao da nota", "codigoProdutoFornecedor", "ABC",
                "gtin", "123", "ncm", "12345678", "cfop", "1102", "unidade", "UN")); p.put("itens", List.of(i));
        long id = id(criar(p).andExpect(status().isCreated()).andExpect(jsonPath("$.dataEntrada").isNotEmpty()));
        mvc.perform(get("/estoque/entradas/" + id).header("Authorization", authorization)).andExpect(status().isOk())
                .andExpect(jsonPath("$.numeroNota").value("100")).andExpect(jsonPath("$.serie").value("1"))
                .andExpect(jsonPath("$.itens[0].codigoProdutoFornecedor").value("ABC"))
                .andExpect(jsonPath("$.itens[0].ncm").value("12345678")).andExpect(jsonPath("$.usuarioCadastroId").isNotEmpty());
    }
    @Test void fornecedorObrigatorio() throws Exception { var p = pedido(); p.remove("fornecedorId"); criar(p).andExpect(status().isBadRequest()); }
    @Test void fornecedorInativoRejeitado() throws Exception { fornecedor.setAtivo(false); fornecedores.saveAndFlush(fornecedor); criar(pedido()).andExpect(status().isConflict()); }
    @Test void fornecedorOutroTenantRejeitado() throws Exception { var p = pedido(); p.put("fornecedorId", fornecedorB.getId()); criar(p).andExpect(status().isNotFound()); }
    @Test void produtoOutroTenantRejeitado() throws Exception { var p = pedido(); p.put("itens", List.of(item(produtoB,"1","1"))); criar(p).andExpect(status().isNotFound()); }
    @Test void produtoInativoRejeitado() throws Exception { produto.setAtivo(false); produtos.saveAndFlush(produto); criar(pedido()).andExpect(status().isConflict()); }
    @Test void produtoSemControleSegueRegraDoEstoque() throws Exception { produto.setControlaEstoque(false); produtos.saveAndFlush(produto); criar(pedido()).andExpect(status().isConflict()); }
    @ParameterizedTest @ValueSource(strings = {"0", "-1", "0.0001", "1000000000"})
    void quantidadeInvalida(String quantidade) throws Exception { var p = pedido(); p.put("itens", List.of(item(produto, quantidade,"1"))); criar(p).andExpect(status().isBadRequest()); }
    @ParameterizedTest @ValueSource(strings = {"-1", "1.001", "1000000000000"})
    void custoInvalido(String custo) throws Exception { var p = pedido(); p.put("itens", List.of(item(produto,"1",custo))); criar(p).andExpect(status().isBadRequest()); }
    @Test void itensObrigatoriosEDuplicadosRejeitados() throws Exception {
        var p = pedido(); p.put("itens", List.of()); criar(p).andExpect(status().isBadRequest());
        p.put("itens", List.of(item(produto,"1","1"),item(produto,"2","1"))); criar(p).andExpect(status().isConflict());
    }
    @ParameterizedTest @ValueSource(strings = {"123", "a1111111111111111111111111111111111111111111"})
    void chaveInvalida(String chave) throws Exception { var p = pedido(); p.put("chaveAcessoNfe",chave); criar(p).andExpect(status().isBadRequest()); }
    @Test void editarRascunhoSubstituiItensSemMovimentar() throws Exception {
        long id = criarEntrada(); var p = pedido(); p.put("itens",List.of(item(produto,"2","4"),item(produto2,"1","2")));
        editar(id,p).andExpect(status().isOk()).andExpect(jsonPath("$.valorTotal").value(10)).andExpect(jsonPath("$.itens.length()").value(2));
        assertThat(movimentos.count()).isZero(); assertThat(saldo(produto)).isEqualByComparingTo("10");
    }
    @Test void confirmacaoMoveEstoqueAtualizaUltimoCustoERegistraAuditoria() throws Exception {
        long id = criarEntrada(); operacao(id,"confirmar").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CONFIRMADA"))
                .andExpect(jsonPath("$.dataConfirmacao").isNotEmpty()).andExpect(jsonPath("$.usuarioConfirmacaoId").isNotEmpty());
        assertThat(saldo(produto)).isEqualByComparingTo("15");
        assertThat(produtos.findById(produto.getId()).orElseThrow().getPrecoCusto()).isEqualByComparingTo("3.50");
        var m = movimentos.findAll().getFirst(); assertThat(m.getTipo()).isEqualTo(TipoMovimentacaoEstoque.ENTRADA);
        assertThat(m.getOrigem()).isEqualTo(OrigemMovimentacaoEstoque.COMPRA); assertThat(m.getSaldoAnterior()).isEqualByComparingTo("10");
        assertThat(m.getSaldoPosterior()).isEqualByComparingTo("15"); assertThat(m.getEmpresa().getId()).isEqualTo(empresa.getId());
    }
    @Test void confirmaVariosItensEPermiteCustoZero() throws Exception {
        var p = pedido(); p.put("itens",List.of(item(produto,"2","0"),item(produto2,"3","4"))); long id = id(criar(p).andExpect(status().isCreated()));
        operacao(id,"confirmar").andExpect(status().isOk()); assertThat(saldo(produto)).isEqualByComparingTo("12");
        assertThat(saldo(produto2)).isEqualByComparingTo("13"); assertThat(movimentos.count()).isEqualTo(2);
        assertThat(produtos.findById(produto.getId()).orElseThrow().getPrecoCusto()).isEqualByComparingTo("0");
    }
    @Test void confirmacaoRepetidaNaoDuplicaEMudancaPosteriorNaoImpedeRetry() throws Exception {
        long id = criarEntrada(); operacao(id,"confirmar").andExpect(status().isOk());
        fornecedor.setAtivo(false); fornecedores.saveAndFlush(fornecedor);
        operacao(id,"confirmar").andExpect(status().isOk()); assertThat(movimentos.count()).isEqualTo(1); assertThat(saldo(produto)).isEqualByComparingTo("15");
    }
    @Test void criacaoIdempotenteMesmoPadraoDeVenda() throws Exception {
        var p = pedido(); p.put("chaveRequisicao",UUID.randomUUID()); long id = id(criar(p).andExpect(status().isCreated()));
        criar(p).andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(id)); assertThat(entradas.count()).isEqualTo(1);
        p.put("observacao","Outro pedido"); criar(p).andExpect(status().isConflict());
    }
    @Test void fornecedorInativadoDepoisDoRascunhoBloqueiaConfirmacao() throws Exception {
        long id = criarEntrada(); fornecedor.setAtivo(false); fornecedores.saveAndFlush(fornecedor);
        operacao(id,"confirmar").andExpect(status().isConflict()); assertThat(movimentos.count()).isZero();
    }
    @Test void produtoInativadoDepoisDoRascunhoBloqueiaConfirmacao() throws Exception {
        long id = criarEntrada(); produto.setAtivo(false); produtos.saveAndFlush(produto);
        operacao(id,"confirmar").andExpect(status().isConflict()); assertThat(movimentos.count()).isZero();
    }
    @Test void cancelarReverteComSaidaPreservaOriginalEIdempotencia() throws Exception {
        long id = criarEntrada(); operacao(id,"confirmar").andExpect(status().isOk()); long original = movimentos.findAll().getFirst().getId();
        operacao(id,"cancelar").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELADA"))
                .andExpect(jsonPath("$.itens[0].movimentacaoEstoqueId").value(original)).andExpect(jsonPath("$.itens[0].movimentacaoCancelamentoId").isNotEmpty());
        operacao(id,"cancelar").andExpect(status().isOk()); assertThat(saldo(produto)).isEqualByComparingTo("10"); assertThat(movimentos.count()).isEqualTo(2);
        var m = movimentos.findAll().stream().filter(v -> !v.getId().equals(original)).findFirst().orElseThrow();
        assertThat(m.getTipo()).isEqualTo(TipoMovimentacaoEstoque.SAIDA); assertThat(m.getOrigem()).isEqualTo(OrigemMovimentacaoEstoque.CANCELAMENTO);
        assertThat(movimentos.findById(original)).isPresent();
        assertThat(produtos.findById(produto.getId()).orElseThrow().getPrecoCusto()).isEqualByComparingTo("3.50");
    }
    @Test void cancelamentoHistoricoFuncionaMesmoComCadastrosInativosESemControleAtual() throws Exception {
        long id = criarEntrada(); operacao(id,"confirmar").andExpect(status().isOk());
        jdbc.update("update produtos set ativo=false, controla_estoque=false where id=?",produto.getId());
        fornecedor.setAtivo(false); fornecedores.saveAndFlush(fornecedor);
        operacao(id,"cancelar").andExpect(status().isOk()); assertThat(saldo(produto)).isEqualByComparingTo("10");
    }
    @Test void transicoesInvalidasNaoGeramMovimentos() throws Exception {
        long id = criarEntrada(); operacao(id,"cancelar").andExpect(status().isConflict()); operacao(id,"confirmar").andExpect(status().isOk());
        editar(id,pedido()).andExpect(status().isConflict()); operacao(id,"cancelar").andExpect(status().isOk());
        editar(id,pedido()).andExpect(status().isConflict()); operacao(id,"confirmar").andExpect(status().isConflict()); assertThat(movimentos.count()).isEqualTo(2);
    }
    @Test void getEditConfirmCancelDeOutroTenantRetornam404() throws Exception {
        long id = criarEntrada();
        mvc.perform(get("/estoque/entradas/"+id).header("Authorization",authorizationB)).andExpect(status().isNotFound());
        mvc.perform(put("/estoque/entradas/"+id).header("Authorization",authorizationB).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(pedido()))).andExpect(status().isNotFound());
        for (String acao : List.of("confirmar","cancelar")) mvc.perform(post("/estoque/entradas/"+id+"/"+acao)
                .header("Authorization",authorizationB)).andExpect(status().isNotFound());
        mvc.perform(get("/estoque/entradas").header("Authorization",authorizationB)).andExpect(jsonPath("$.totalItems").value(0));
    }
    @Test void edicaoNaoAlteraTenantEFalhaComReferenciasEstrangeiras() throws Exception {
        long id = criarEntrada(); var p = pedido(); p.put("empresaId",outra.getId()); editar(id,p).andExpect(status().isOk());
        assertThat(entradas.findById(id).orElseThrow().getEmpresa().getId()).isEqualTo(empresa.getId());
        p.put("fornecedorId",fornecedorB.getId()); editar(id,p).andExpect(status().isNotFound());
        p.put("fornecedorId",fornecedor.getId()); p.put("itens",List.of(item(produtoB,"1","1"))); editar(id,p).andExpect(status().isNotFound());
        mvc.perform(get("/estoque/entradas/"+id).header("Authorization",authorization)).andExpect(jsonPath("$.itens.length()").value(1));
    }
    @Test void paginacaoFiltrosCombinadosOrdenacaoETieBreaker() throws Exception {
        long primeiro = criarEntrada(); var p = pedido(); p.put("numeroNota","NOTA-X"); long segundo = id(criar(p).andExpect(status().isCreated()));
        p.put("dataEntrada","2026-10-03"); p.put("numeroNota","NOTA-Y"); long terceiro = id(criar(p).andExpect(status().isCreated()));
        operacao(segundo,"confirmar").andExpect(status().isOk());
        mvc.perform(get("/estoque/entradas").header("Authorization",authorization).param("size","1"))
                .andExpect(jsonPath("$.totalItems").value(3)).andExpect(jsonPath("$.totalPages").value(3)).andExpect(jsonPath("$.items[0].id").value(terceiro));
        mvc.perform(get("/estoque/entradas").header("Authorization",authorization).param("size","1").param("page","1"))
                .andExpect(jsonPath("$.items[0].id").value(segundo));
        mvc.perform(get("/estoque/entradas").header("Authorization",authorization).param("sort","id,asc"))
                .andExpect(jsonPath("$.items[0].id").value(primeiro));
        mvc.perform(get("/estoque/entradas").header("Authorization",authorization).param("termo","abc").param("status","CONFIRMADA")
                .param("origem","MANUAL").param("fornecedorId",fornecedor.getId().toString()).param("dataInicial","2026-10-02").param("dataFinal","2026-10-02"))
                .andExpect(jsonPath("$.totalItems").value(1)).andExpect(jsonPath("$.items[0].id").value(segundo));
        mvc.perform(get("/estoque/entradas").header("Authorization",authorization).param("termo","nota-y")).andExpect(jsonPath("$.totalItems").value(1));
        mvc.perform(get("/estoque/entradas").header("Authorization",authorization).param("origem","XML")).andExpect(jsonPath("$.totalItems").value(0));
    }
    @ParameterizedTest @CsvSource({"page,-1,","size,0,","size,101,","sort,nome,desc","sort,id,invalido","status,INVALIDO,","dataInicial,nao-data,"})
    void parametrosInvalidos(String parametro, String valor, String extra) throws Exception {
        mvc.perform(get("/estoque/entradas").header("Authorization",authorization).param(parametro,extra == null ? valor : valor+","+extra))
                .andExpect(status().isBadRequest());
    }
    @Test void periodoInvertidoRejeitado() throws Exception {
        mvc.perform(get("/estoque/entradas").header("Authorization",authorization).param("dataInicial","2026-10-03").param("dataFinal","2026-10-02"))
                .andExpect(status().isBadRequest());
    }
    @Test void naoAutenticadoRecebe401() throws Exception { mvc.perform(get("/estoque/entradas")).andExpect(status().isUnauthorized()); }
    @Test void rollbackDepoisDePrimeiroItemConfirmado() throws Exception {
        var p = pedido(); p.put("itens",List.of(item(produto,"2","4"),item(produto2,"3","5"))); long id = id(criar(p).andExpect(status().isCreated()));
        AtomicInteger chamadas = new AtomicInteger();
        doAnswer(inv -> { var resultado = inv.callRealMethod(); if (chamadas.incrementAndGet()==2) throw new IllegalStateException("Falha simulada apos movimento"); return resultado; })
                .when(estoque).movimentar(anyLong(),anyLong(),anyLong(),any(),any(),any(),any());
        operacao(id,"confirmar").andExpect(status().isInternalServerError());
        assertThat(saldo(produto)).isEqualByComparingTo("10"); assertThat(saldo(produto2)).isEqualByComparingTo("10"); assertThat(movimentos.count()).isZero();
        assertThat(produtos.findById(produto.getId()).orElseThrow().getPrecoCusto()).isEqualByComparingTo("2");
        mvc.perform(get("/estoque/entradas/"+id).header("Authorization",authorization)).andExpect(jsonPath("$.status").value("RASCUNHO"))
                .andExpect(jsonPath("$.itens[0].movimentacaoEstoqueId").isEmpty()).andExpect(jsonPath("$.dataConfirmacao").isEmpty());
    }
    @Test void saldoInsuficienteNoSegundoItemCancelaTodaReversao() throws Exception {
        var p = pedido(); p.put("itens",List.of(item(produto,"2","4"),item(produto2,"3","5"))); long id = id(criar(p).andExpect(status().isCreated()));
        operacao(id,"confirmar").andExpect(status().isOk());
        var user = usuarios.findAll().stream().filter(u -> u.getEmpresa().getId().equals(empresa.getId())).findFirst().orElseThrow();
        estoque.movimentar(empresa.getId(),produto2.getId(),user.getId(),TipoMovimentacaoEstoque.SAIDA,OrigemMovimentacaoEstoque.MANUAL,new BigDecimal("12"),"Consumo posterior");
        operacao(id,"cancelar").andExpect(status().isConflict());
        assertThat(saldo(produto)).isEqualByComparingTo("12"); assertThat(saldo(produto2)).isEqualByComparingTo("1"); assertThat(movimentos.count()).isEqualTo(3);
        mvc.perform(get("/estoque/entradas/"+id).header("Authorization",authorization)).andExpect(jsonPath("$.status").value("CONFIRMADA"))
                .andExpect(jsonPath("$.itens[0].movimentacaoCancelamentoId").isEmpty()).andExpect(jsonPath("$.dataCancelamento").isEmpty());
    }
    @Test void movimentoOriginalInconsistenteImpedeCancelamento() throws Exception {
        long id = criarEntrada(); operacao(id,"confirmar").andExpect(status().isOk());
        jdbc.update("update movimentacoes_estoque set origem='MANUAL'"); operacao(id,"cancelar").andExpect(status().isConflict());
        assertThat(saldo(produto)).isEqualByComparingTo("15"); assertThat(movimentos.count()).isEqualTo(1);
    }
}
