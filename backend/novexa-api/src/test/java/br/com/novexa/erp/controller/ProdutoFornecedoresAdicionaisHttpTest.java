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
import java.util.List;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:produto-fornecedores-adicionais;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.username=sa", "spring.datasource.password=", "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false", "spring.jpa.properties.hibernate.generate_statistics=true",
    "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=60000"
})
@AutoConfigureMockMvc
@Transactional
class ProdutoFornecedoresAdicionaisHttpTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired ProdutoRepository produtos;
    @Autowired FornecedorRepository fornecedores;
    @Autowired ProdutoFornecedorRepository vinculos;
    @Autowired JwtService jwt;
    @Autowired EntityManager em;
    EmpresaEntity empresaA, empresaB;
    String tokenA, tokenB;
    long fornecedorA, fornecedorA2, fornecedorA3, fornecedorB;

    @BeforeEach void preparar() throws Exception {
        empresaA = empresa("A"); empresaB = empresa("B");
        tokenA = token(empresaA, "12345678909"); tokenB = token(empresaB, "52998224725");
        fornecedorA = fornecedor(tokenA, "Distribuidora A");
        fornecedorA2 = fornecedor(tokenA, "Distribuidora A2");
        fornecedorA3 = fornecedor(tokenA, "Distribuidora A3");
        fornecedorB = fornecedor(tokenB, "Distribuidora B");
    }

    @Test void cadastraComVinculosAdicionaisDesdeOCriarERetornaNoDetalhe() throws Exception {
        long id = criar(tokenA, Map.of("fornecedorId", fornecedorA,
                "fornecedoresAdicionais", List.of(
                        Map.of("fornecedorId", fornecedorA2, "codigoReferencia", "REF-A2-01"),
                        Map.of("fornecedorId", fornecedorA3))));
        mvc.perform(get("/produtos/" + id).header("Authorization", tokenA)).andExpect(status().isOk())
            .andExpect(jsonPath("$.fornecedor.id").value(fornecedorA))
            .andExpect(jsonPath("$.fornecedoresAdicionais.length()").value(2))
            .andExpect(jsonPath("$.fornecedoresAdicionais[0].fornecedor.id").value(fornecedorA2))
            .andExpect(jsonPath("$.fornecedoresAdicionais[0].fornecedor.razaoSocial").value("Distribuidora A2"))
            .andExpect(jsonPath("$.fornecedoresAdicionais[0].codigoReferencia").value("REF-A2-01"))
            .andExpect(jsonPath("$.fornecedoresAdicionais[1].fornecedor.id").value(fornecedorA3))
            .andExpect(jsonPath("$.fornecedoresAdicionais[1].codigoReferencia").isEmpty());
        em.flush(); em.clear();
        assertThat(vinculos.findByProdutoIdAndEmpresaId(id, empresaA.getId())).hasSize(2);
    }

    @Test void edicaoSubstituiListaEListaVaziaRemoveTodos() throws Exception {
        long id = criar(tokenA, Map.of("fornecedoresAdicionais", List.of(
                Map.of("fornecedorId", fornecedorA2, "codigoReferencia", "ANTIGA"))));
        mvc.perform(put("/produtos/" + id).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(dados(Map.of("fornecedoresAdicionais", List.of(
                    Map.of("fornecedorId", fornecedorA3, "codigoReferencia", "NOVA")))))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.fornecedoresAdicionais.length()").value(1))
            .andExpect(jsonPath("$.fornecedoresAdicionais[0].fornecedor.id").value(fornecedorA3))
            .andExpect(jsonPath("$.fornecedoresAdicionais[0].codigoReferencia").value("NOVA"));
        em.flush(); em.clear();
        assertThat(vinculos.findByProdutoIdAndEmpresaId(id, empresaA.getId())).hasSize(1);

        var limpar = dados(Map.of()); limpar.put("fornecedoresAdicionais", List.of());
        mvc.perform(put("/produtos/" + id).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(limpar))).andExpect(status().isOk())
            .andExpect(jsonPath("$.fornecedoresAdicionais.length()").value(0));
        em.flush(); em.clear();
        assertThat(vinculos.findByProdutoIdAndEmpresaId(id, empresaA.getId())).isEmpty();
    }

    @Test void omissaoNaEdicaoPreservaVinculosExistentes() throws Exception {
        long id = criar(tokenA, Map.of("fornecedoresAdicionais", List.of(
                Map.of("fornecedorId", fornecedorA2, "codigoReferencia", "PRESERVAR"))));
        mvc.perform(put("/produtos/" + id).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(dados(Map.of("nome", "Produto Renomeado")))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.fornecedoresAdicionais.length()").value(1))
            .andExpect(jsonPath("$.fornecedoresAdicionais[0].codigoReferencia").value("PRESERVAR"));
        em.flush(); em.clear();
        assertThat(vinculos.findByProdutoIdAndEmpresaId(id, empresaA.getId())).hasSize(1);
    }

    @Test void rejeitaFornecedorDeOutroTenantSemCriarNemAlterarProduto() throws Exception {
        mvc.perform(post("/produtos").header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(dados(Map.of("fornecedoresAdicionais", List.of(
                    Map.of("fornecedorId", fornecedorB, "codigoReferencia", "X")))))))
            .andExpect(status().isNotFound());
        assertThat(produtos.count()).isZero();

        long id = criar(tokenA, Map.of("fornecedoresAdicionais", List.of(
                Map.of("fornecedorId", fornecedorA2, "codigoReferencia", "OK"))));
        mvc.perform(put("/produtos/" + id).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(dados(Map.of("fornecedoresAdicionais", List.of(
                    Map.of("fornecedorId", fornecedorB)))))))
            .andExpect(status().isNotFound());
        em.flush(); em.clear();
        assertThat(vinculos.findByProdutoIdAndEmpresaId(id, empresaA.getId())).hasSize(1);
    }

    @Test void rejeitaDuplicadoIgualAoPrincipalEFornecedorAusente() throws Exception {
        mvc.perform(post("/produtos").header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(dados(Map.of("fornecedoresAdicionais", List.of(
                    Map.of("fornecedorId", fornecedorA2), Map.of("fornecedorId", fornecedorA2)))))))
            .andExpect(status().isBadRequest());
        mvc.perform(post("/produtos").header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(dados(Map.of("fornecedorId", fornecedorA,
                    "fornecedoresAdicionais", List.of(Map.of("fornecedorId", fornecedorA)))))))
            .andExpect(status().isBadRequest());
        mvc.perform(post("/produtos").header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(dados(Map.of("fornecedoresAdicionais", List.of(Map.of("codigoReferencia", "SEM-ID")))))))
            .andExpect(status().isBadRequest());
        assertThat(produtos.count()).isZero();
    }

    @Test void listaEPesquisaRetornamVinculosSemConsultaPorLinha() throws Exception {
        for (int i = 0; i < 12; i++)
            criar(tokenA, Map.of("nome", "Produto " + String.format("%02d", i),
                    "fornecedoresAdicionais", List.of(Map.of("fornecedorId", fornecedorA2, "codigoReferencia", "R-" + i))));
        em.flush(); em.clear();
        var stats = em.getEntityManagerFactory().unwrap(org.hibernate.SessionFactory.class).getStatistics(); stats.clear();
        mvc.perform(get("/produtos").header("Authorization", tokenA).param("size", "5").param("page", "0"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].fornecedoresAdicionais[0].fornecedor.razaoSocial").value("Distribuidora A2"));
        assertThat(stats.getEntityStatistics(FornecedorEntity.class.getName()).getFetchCount()).isZero();
        em.clear(); stats.clear();
        mvc.perform(get("/produtos/buscar").header("Authorization", tokenA).param("termo", "Produto"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].fornecedoresAdicionais[0].codigoReferencia").isString());
        assertThat(stats.getEntityStatistics(FornecedorEntity.class.getName()).getFetchCount()).isZero();
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
