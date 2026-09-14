package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.entity.PerfilUsuario;
import br.com.novexa.erp.entity.ProdutoEntity;
import br.com.novexa.erp.entity.UsuarioEntity;
import br.com.novexa.erp.entity.TipoMovimentacaoEstoque;
import br.com.novexa.erp.entity.OrigemMovimentacaoEstoque;
import br.com.novexa.erp.repository.EmpresaRepository;
import br.com.novexa.erp.repository.MovimentacaoEstoqueRepository;
import br.com.novexa.erp.repository.ProdutoRepository;
import br.com.novexa.erp.repository.UsuarioRepository;
import br.com.novexa.erp.service.JwtService;
import br.com.novexa.erp.service.MovimentacaoEstoqueService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:movimentacao-http;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.show-sql=false",
        "novexa.jwt.secret=01234567890123456789012345678901",
        "novexa.jwt.expiration-ms=60000"
})
@AutoConfigureMockMvc
@Transactional
class MovimentacaoEstoqueHttpTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private EmpresaRepository empresas;
    @Autowired private ProdutoRepository produtos;
    @Autowired private UsuarioRepository usuarios;
    @Autowired private MovimentacaoEstoqueRepository movimentos;
    @Autowired private JwtService jwtService;
    @Autowired private EntityManager entityManager;
    @Autowired private MovimentacaoEstoqueService estoque;

    private EmpresaEntity empresa1;
    private EmpresaEntity empresa2;
    private ProdutoEntity produto1;
    private ProdutoEntity produto2;
    private UsuarioEntity usuario1;
    private String authorization;

    @BeforeEach
    void preparar() {
        empresa1 = empresa("Empresa 1", "11222333000181");
        empresa2 = empresa("Empresa 2", "12345678000190");
        usuario1 = usuario(empresa1, "02360684663");
        produto1 = produto(empresa1, "Produto 1", new BigDecimal("100.000"));
        produto2 = produto(empresa2, "Produto 2", new BigDecimal("50.000"));
        authorization = "Bearer " + jwtService.gerarToken(usuario1.getId(), usuario1.getCpf(), empresa1.getId(), PerfilUsuario.USUARIO);
    }

    @Test
    void entradaAutenticadaRetornaSucesso() throws Exception {
        mvc.perform(post("/estoque/movimentacoes/entrada")
                        .header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "produtoId", produto1.getId(),
                                "quantidade", 10,
                                "motivo", "Entrada manual"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tipo").value("ENTRADA"))
                .andExpect(jsonPath("$.origem").value("MANUAL"))
                .andExpect(jsonPath("$.quantidade").value(10))
                .andExpect(jsonPath("$.saldoPosterior").value(110.000));
    }

    @Test
    void entradaAlteraSaldoCorretamente() throws Exception {
        mvc.perform(post("/estoque/movimentacoes/entrada")
                        .header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "produtoId", produto1.getId(),
                                "quantidade", 25,
                                "motivo", "Entrada"
                        ))))
                .andExpect(status().isCreated());

        entityManager.flush();
        entityManager.clear();

        var produtoAtualizado = produtos.findById(produto1.getId()).orElseThrow();
        assertThat(produtoAtualizado.getEstoqueAtual()).isEqualByComparingTo("125.000");
    }

    @Test
    void saidaAutenticadaRetornaSucesso() throws Exception {
        mvc.perform(post("/estoque/movimentacoes/saida")
                        .header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "produtoId", produto1.getId(),
                                "quantidade", 20,
                                "motivo", "Saida manual"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tipo").value("SAIDA"))
                .andExpect(jsonPath("$.origem").value("MANUAL"))
                .andExpect(jsonPath("$.quantidade").value(20))
                .andExpect(jsonPath("$.saldoPosterior").value(80.000));
    }

    @Test
    void saidaComSaldoInsuficienteRetornaErroAdequado() throws Exception {
        var produtoPoucoEstoque = produto(empresa1, "Produto Baixo", new BigDecimal("5.000"));

        mvc.perform(post("/estoque/movimentacoes/saida")
                        .header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "produtoId", produtoPoucoEstoque.getId(),
                                "quantidade", 10,
                                "motivo", "Venda sem estoque"
                        ))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").doesNotExist())
                .andExpect(jsonPath("$").value(org.hamcrest.Matchers.containsString("Saldo insuficiente")));

        entityManager.flush();
        entityManager.clear();

        var produtoInalterado = produtos.findById(produtoPoucoEstoque.getId()).orElseThrow();
        assertThat(produtoInalterado.getEstoqueAtual()).isEqualByComparingTo("5.000");
    }

    @Test
    void ajusteAutenticadoRetornaSucesso() throws Exception {
        mvc.perform(post("/estoque/movimentacoes/ajuste")
                        .header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "produtoId", produto1.getId(),
                                "quantidade", 80,
                                "motivo", "Inventario fisico"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tipo").value("AJUSTE"))
                .andExpect(jsonPath("$.origem").value("AJUSTE"))
                .andExpect(jsonPath("$.quantidade").value(80))
                .andExpect(jsonPath("$.saldoPosterior").value(80.000));
    }

    @Test
    void ajusteDefineSaldoFinalCorretamente() throws Exception {
        mvc.perform(post("/estoque/movimentacoes/ajuste")
                        .header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "produtoId", produto1.getId(),
                                "quantidade", 30,
                                "motivo", "Ajuste"
                        ))))
                .andExpect(status().isCreated());

        entityManager.flush();
        entityManager.clear();

        var produtoAtualizado = produtos.findById(produto1.getId()).orElseThrow();
        assertThat(produtoAtualizado.getEstoqueAtual()).isEqualByComparingTo("30.000");
    }

    @ParameterizedTest
    @ValueSource(strings = {"/estoque/movimentacoes/entrada", "/estoque/movimentacoes/saida", "/estoque/movimentacoes/ajuste", "/estoque/movimentacoes/produto/1"})
    void requestSemJwtRetorna401(String url) throws Exception {
        mvc.perform(post(url).contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized());

        mvc.perform(post(url).header(HttpHeaders.AUTHORIZATION, "Bearer token-invalido")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @ValueSource(strings = {"entrada", "saida", "ajuste"})
    void usuarioEmpresaANaoMovimentaProdutoEmpresaB(String operacao) throws Exception {
        mvc.perform(post("/estoque/movimentacoes/" + operacao)
                        .param("empresaId", empresa2.getId().toString())
                        .header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "produtoId", produto2.getId(),
                                "empresaId", empresa2.getId(),
                                "quantidade", 10,
                                "motivo", "Tentativa indevida"
                        ))))
                .andExpect(status().isNotFound());

        entityManager.flush();
        entityManager.clear();

        var produtoInalterado = produtos.findById(produto2.getId()).orElseThrow();
        assertThat(produtoInalterado.getEstoqueAtual()).isEqualByComparingTo("50.000");
    }

    @Test
    void usuarioEmpresaANaoConsultaHistoricoProdutoEmpresaB() throws Exception {
        var usuario2 = usuario(empresa2, "12345678901");
        estoque.movimentar(empresa2.getId(), produto2.getId(), usuario2.getId(),
                TipoMovimentacaoEstoque.ENTRADA, OrigemMovimentacaoEstoque.MANUAL,
                BigDecimal.ONE, "Movimento da outra empresa");
        entityManager.flush();
        assertThat(movimentos.findByEmpresaIdAndProdutoIdOrderByDataHoraDesc(empresa2.getId(), produto2.getId()))
                .hasSize(1);
        mvc.perform(get("/estoque/movimentacoes/produto/" + produto2.getId())
                        .param("empresaId", empresa2.getId().toString())
                        .header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void historicoRetornaMovimentacoesNaOrdemCorreta() throws Exception {
        mvc.perform(post("/estoque/movimentacoes/entrada")
                        .header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "produtoId", produto1.getId(),
                                "quantidade", 10,
                                "motivo", "Primeira"
                        ))))
                .andExpect(status().isCreated());

        mvc.perform(post("/estoque/movimentacoes/saida")
                        .header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "produtoId", produto1.getId(),
                                "quantidade", 5,
                                "motivo", "Segunda"
                        ))))
                .andExpect(status().isCreated());

        mvc.perform(post("/estoque/movimentacoes/ajuste")
                        .header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "produtoId", produto1.getId(),
                                "quantidade", 20,
                                "motivo", "Terceira"
                        ))))
                .andExpect(status().isCreated());

        var resultado = mvc.perform(get("/estoque/movimentacoes/produto/" + produto1.getId())
                        .header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andReturn();

        var lista = json.readTree(resultado.getResponse().getContentAsString());
        assertThat(lista.get(0).get("motivo").asText()).isEqualTo("Terceira");
        assertThat(lista.get(1).get("motivo").asText()).isEqualTo("Segunda");
        assertThat(lista.get(2).get("motivo").asText()).isEqualTo("Primeira");
    }

    @Test
    void requestSemProdutoIdRejeitado() throws Exception {
        mvc.perform(post("/estoque/movimentacoes/entrada")
                        .header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "quantidade", 10,
                                "motivo", "Sem produto"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$").value(org.hamcrest.Matchers.containsString("Produto é obrigatório")));
    }

    @Test
    void requestSemQuantidadeRejeitado() throws Exception {
        mvc.perform(post("/estoque/movimentacoes/entrada")
                        .header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "produtoId", produto1.getId(),
                                "motivo", "Sem quantidade"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$").value(org.hamcrest.Matchers.containsString("Quantidade é obrigatória")));
    }

    private EmpresaEntity empresa(String nome, String cnpj) {
        EmpresaEntity empresa = new EmpresaEntity();
        empresa.setRazaoSocial(nome);
        empresa.setCnpj(cnpj);
        empresa.setAtivo(true);
        return empresas.saveAndFlush(empresa);
    }

    private UsuarioEntity usuario(EmpresaEntity empresa, String cpf) {
        UsuarioEntity u = new UsuarioEntity();
        u.setEmpresa(empresa);
        u.setCpf(cpf);
        u.setNomeUsuario("Operador");
        u.setSenha("hash de teste");
        u.setPerfil(PerfilUsuario.USUARIO);
        return usuarios.saveAndFlush(u);
    }

    private ProdutoEntity produto(EmpresaEntity empresa, String nome, BigDecimal estoqueInicial) {
        ProdutoEntity produto = new ProdutoEntity();
        produto.setEmpresa(empresa);
        produto.setNome(nome);
        produto.setCodigoInterno("SKU-" + System.currentTimeMillis());
        produto.setCodigoBarras("789" + System.currentTimeMillis());
        produto.setUnidadeMedida("UN");
        produto.setPrecoVenda(new BigDecimal("19.90"));
        produto.setEstoqueAtual(estoqueInicial);
        produto.setControlaEstoque(true);
        produto.setAtivo(true);
        return produtos.saveAndFlush(produto);
    }
}
