package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.service.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import jakarta.persistence.EntityManager;
import java.util.HashMap;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:produto-fornecedor;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.username=sa", "spring.datasource.password=", "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false", "spring.jpa.properties.hibernate.generate_statistics=true",
    "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=60000"
})
@AutoConfigureMockMvc
@Transactional
class ProdutoFornecedorHttpTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired ProdutoRepository produtos;
    @Autowired FornecedorRepository fornecedores;
    @Autowired JwtService jwt;
    @Autowired EntityManager em;
    EmpresaEntity empresaA, empresaB;
    String tokenA, tokenB;
    long fornecedorA, fornecedorA2, fornecedorB;

    @BeforeEach void preparar() throws Exception {
        empresaA = empresa("A"); empresaB = empresa("B");
        tokenA = token(empresaA, "12345678909"); tokenB = token(empresaB, "52998224725");
        fornecedorA = fornecedor(tokenA, "Distribuidora A"); fornecedorA2 = fornecedor(tokenA, "Distribuidora A2");
        fornecedorB = fornecedor(tokenB, "Distribuidora B");
    }

    @Test void cadastraConsultaTrocaERemoveUmUnicoFornecedorPrincipal() throws Exception {
        long id = criar(tokenA, Map.of("fornecedorId", fornecedorA));
        mvc.perform(get("/produtos/" + id).header("Authorization", tokenA)).andExpect(status().isOk())
            .andExpect(jsonPath("$.fornecedor.id").value(fornecedorA)).andExpect(jsonPath("$.fornecedor.razaoSocial").value("Distribuidora A"))
            .andExpect(jsonPath("$.fornecedor.ativo").value(true)).andExpect(jsonPath("$.fornecedor.empresaId").doesNotExist());
        mvc.perform(put("/produtos/" + id).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(dados(Map.of("fornecedorId", fornecedorA2)))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.fornecedor.id").value(fornecedorA2));
        var semFornecedor = dados(Map.of()); semFornecedor.put("fornecedorId", null);
        mvc.perform(put("/produtos/" + id).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(semFornecedor))).andExpect(status().isOk()).andExpect(jsonPath("$.fornecedor").isEmpty());
        em.flush(); em.clear(); assertThat(produtos.findById(id).orElseThrow().getFornecedorPrincipal()).isNull();
    }

    @Test void omissaoPreservaVinculoEProdutosLegadosContinuamSemFornecedor() throws Exception {
        long legado = criar(tokenA, Map.of());
        long id = criar(tokenA, Map.of("fornecedorId", fornecedorA));
        for (long produtoId : new long[]{legado, id}) {
            mvc.perform(put("/produtos/" + produtoId).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(dados(Map.of("fornecedorInformado", true, "fornecedor", Map.of("id", fornecedorB))))))
                .andExpect(status().isOk());
        }
        em.flush(); em.clear();
        assertThat(produtos.findById(legado).orElseThrow().getFornecedorPrincipal()).isNull();
        assertThat(produtos.findById(id).orElseThrow().getFornecedorPrincipal().getId()).isEqualTo(fornecedorA);
    }

    @Test void rejeitaReferenciaDeOutroTenantNaCriacaoEEdicaoSemAlterarProduto() throws Exception {
        mvc.perform(post("/produtos").header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(dados(Map.of("fornecedorId", fornecedorB, "empresaId", empresaB.getId())))))
            .andExpect(status().isNotFound());
        assertThat(produtos.count()).isZero();
        long id = criar(tokenA, Map.of("fornecedorId", fornecedorA));
        mvc.perform(put("/produtos/" + id).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(dados(Map.of("fornecedorId", fornecedorB, "nome", "Inválido")))))
            .andExpect(status().isNotFound());
        mvc.perform(get("/produtos/" + id).header("Authorization", tokenA)).andExpect(status().isOk())
            .andExpect(jsonPath("$.nome").value("Produto")).andExpect(jsonPath("$.fornecedor.id").value(fornecedorA));
        mvc.perform(get("/produtos/" + id).header("Authorization", tokenB)).andExpect(status().isNotFound());
        mvc.perform(get("/produtos").header("Authorization", tokenB)).andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(0));
    }

    @Test void fornecedorInativadoContinuaIdentificadoSemApagarVinculo() throws Exception {
        long id = criar(tokenA, Map.of("fornecedorId", fornecedorA));
        mvc.perform(delete("/fornecedores/" + fornecedorA).header("Authorization", tokenA)).andExpect(status().isNoContent());
        mvc.perform(get("/produtos/" + id).header("Authorization", tokenA)).andExpect(status().isOk())
            .andExpect(jsonPath("$.fornecedor.id").value(fornecedorA)).andExpect(jsonPath("$.fornecedor.ativo").value(false));
        mvc.perform(put("/produtos/" + id).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(dados(Map.of("fornecedorId", fornecedorA)))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.fornecedor.id").value(fornecedorA));
        assertThat(fornecedores.findById(fornecedorA)).isPresent();
    }

    @Test void listaEPesquisaComFornecedorSemConsultaPorLinhaEPreservaPaginacao() throws Exception {
        for (int i = 0; i < 12; i++) criar(tokenA, Map.of("nome", "Produto " + String.format("%02d", i), "fornecedorId", fornecedor(tokenA, "Fornecedor " + i)));
        criar(tokenB, Map.of("nome", "Produto alheio", "fornecedorId", fornecedorB));
        em.flush(); em.clear();
        var stats = em.getEntityManagerFactory().unwrap(org.hibernate.SessionFactory.class).getStatistics(); stats.clear();
        mvc.perform(get("/produtos").header("Authorization", tokenA).param("size", "5").param("page", "1").param("sort", "nome,desc"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(12)).andExpect(jsonPath("$.totalPages").value(3))
            .andExpect(jsonPath("$.items[0].nome").value("Produto 06")).andExpect(jsonPath("$.items[0].fornecedor.razaoSocial").value("Fornecedor 6"));
        assertThat(stats.getEntityStatistics(FornecedorEntity.class.getName()).getFetchCount()).isZero();
        em.clear(); stats.clear();
        mvc.perform(get("/produtos/buscar").header("Authorization", tokenA).param("termo", "Produto"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(10)).andExpect(jsonPath("$[0].fornecedor.id").isNumber());
        assertThat(stats.getEntityStatistics(FornecedorEntity.class.getName()).getFetchCount()).isZero();
    }

    @Test void validaFornecedorIdEExigeAutenticacaoSemNovoEfeitoOperacional() throws Exception {
        for (long id : new long[]{0L, -1L})
            mvc.perform(post("/produtos").header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(dados(Map.of("fornecedorId", id))))).andExpect(status().isBadRequest());
        mvc.perform(post("/produtos").header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(dados(Map.of("fornecedorId", Long.MAX_VALUE))))).andExpect(status().isNotFound());
        mvc.perform(post("/produtos").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dados(Map.of()))))
            .andExpect(status().isUnauthorized());
        long id = criar(tokenA, Map.of("fornecedorId", fornecedorA));
        var p = produtos.findById(id).orElseThrow();
        assertThat(p.getEstoqueAtual()).isEqualByComparingTo("0"); assertThat(p.getPrecoCusto()).isEqualByComparingTo("3");
        assertThat(p.getPrecoVenda()).isEqualByComparingTo("10");
    }

    long criar(String token, Map<String, Object> extras) throws Exception {
        var r = mvc.perform(post("/produtos").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(dados(extras)))).andExpect(status().isCreated()).andReturn();
        return json.readTree(r.getResponse().getContentAsString()).get("id").asLong();
    }
    Map<String, Object> dados(Map<String, Object> extras) {
        var dados = new HashMap<String, Object>(Map.of("nome", "Produto", "unidadeMedida", "UN", "precoVenda", 10, "precoCusto", 3));
        dados.putAll(extras); return dados;
    }
    long fornecedor(String token, String nome) throws Exception {
        var r = mvc.perform(post("/fornecedores").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(Map.of("razaoSocial", nome)))).andExpect(status().isCreated()).andReturn();
        return json.readTree(r.getResponse().getContentAsString()).get("id").asLong();
    }
    private EmpresaEntity empresa(String nome) { var e = new EmpresaEntity(); e.setRazaoSocial(nome); e.setAtivo(true); return empresas.saveAndFlush(e); }
    private String token(EmpresaEntity empresa, String cpf) {
        var u = new UsuarioEntity(); u.setEmpresa(empresa); u.setCpf(cpf); u.setNomeUsuario("Teste"); u.setSenha("hash"); u.setAtivo(true); u.setPerfil(PerfilUsuario.OPERADOR);
        return "Bearer " + jwt.gerarToken(usuarios.saveAndFlush(u));
    }
}
