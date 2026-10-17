package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.service.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:categorias;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.username=sa", "spring.datasource.password=", "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false",
    "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=60000"
})
@AutoConfigureMockMvc
@Transactional
class CategoriaProdutoHttpTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired CategoriaProdutoRepository categorias;
    @Autowired SubcategoriaProdutoRepository subcategorias;
    @Autowired JwtService jwt;
    EmpresaEntity empresaA, empresaB;
    String tokenA, tokenB;

    @BeforeEach void preparar() {
        empresaA = empresa("A"); empresaB = empresa("B");
        tokenA = token(empresaA, "12345678909", PerfilUsuario.ADMIN);
        tokenB = token(empresaB, "52998224725", PerfilUsuario.OPERADOR);
    }

    @Test void crudPreservaTenantSituacaoERelacionamento() throws Exception {
        long categoria = criar("categorias", tokenA, Map.of("nome", " Bebidas ", "empresaId", empresaB.getId()));
        assertThat(categorias.findById(categoria).orElseThrow().getEmpresa().getId()).isEqualTo(empresaA.getId());
        mvc.perform(get("/produtos/categorias/" + categoria).header("Authorization", tokenA))
            .andExpect(status().isOk()).andExpect(jsonPath("$.nome").value("Bebidas")).andExpect(jsonPath("$.ativo").value(true));
        long sub = criar("subcategorias", tokenA, Map.of("nome", "Sucos", "categoriaId", categoria));
        mvc.perform(put("/produtos/categorias/" + categoria).header("Authorization", tokenA)
            .contentType(MediaType.APPLICATION_JSON).content("{\"nome\":\"Bebidas\",\"ativo\":false}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.ativo").value(false));
        mvc.perform(delete("/produtos/categorias/" + categoria).header("Authorization", tokenA)).andExpect(status().isConflict());
        mvc.perform(get("/produtos/subcategorias/" + sub).header("Authorization", tokenA))
            .andExpect(status().isOk()).andExpect(jsonPath("$.ativo").value(true))
            .andExpect(jsonPath("$.categoria.ativo").value(false));
        long outra = criar("categorias", tokenA, Map.of("nome", "Alimentos"));
        mvc.perform(put("/produtos/subcategorias/" + sub).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(Map.of("nome", "Sucos naturais", "categoriaId", outra, "ativo", false))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.categoria.id").value(outra)).andExpect(jsonPath("$.ativo").value(false));
        mvc.perform(delete("/produtos/categorias/" + outra).header("Authorization", tokenA)).andExpect(status().isConflict());
        mvc.perform(delete("/produtos/subcategorias/" + sub).header("Authorization", tokenA)).andExpect(status().isNoContent());
        mvc.perform(delete("/produtos/categorias/" + outra).header("Authorization", tokenA)).andExpect(status().isNoContent());
        mvc.perform(delete("/produtos/categorias/" + categoria).header("Authorization", tokenA)).andExpect(status().isNoContent());
    }

    @Test void nomesUnicosPorEmpresaIndependemDeCaixaEspacosOuCategoriaPai() throws Exception {
        long cat = criar("categorias", tokenA, Map.of("nome", "Bebidas"));
        long outra = criar("categorias", tokenA, Map.of("nome", "Alimentos"));
        criar("categorias", tokenB, Map.of("nome", "Bebidas"));
        duplicado("categorias", null, Map.of("nome", " bebidas "));
        duplicado("categorias", outra, Map.of("nome", "BEBIDAS"));
        criar("subcategorias", tokenA, Map.of("nome", "Sucos", "categoriaId", cat));
        duplicado("subcategorias", null, Map.of("nome", " SUCOS ", "categoriaId", outra));
        // Uma categoria e uma subcategoria são cadastros distintos.
        criar("subcategorias", tokenA, Map.of("nome", "Bebidas", "categoriaId", cat));
    }

    @Test void bloqueiaLeituraEdicaoExclusaoEAssociacaoEntreEmpresas() throws Exception {
        long cat = criar("categorias", tokenA, Map.of("nome", "Privada"));
        long sub = criar("subcategorias", tokenA, Map.of("nome", "Privada", "categoriaId", cat));
        long catB = criar("categorias", tokenB, Map.of("nome", "Outra"));
        long subB = criar("subcategorias", tokenB, Map.of("nome", "Outra", "categoriaId", catB));
        for (String path : new String[]{"categorias/" + cat, "subcategorias/" + sub}) {
            mvc.perform(get("/produtos/" + path).header("Authorization", tokenB)).andExpect(status().isNotFound());
            mvc.perform(delete("/produtos/" + path).header("Authorization", tokenB)).andExpect(status().isNotFound());
            mvc.perform(put("/produtos/" + path).header("Authorization", tokenB).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(Map.of("nome", "Inválido", "categoriaId", catB)))).andExpect(status().isNotFound());
        }
        for (var request : new org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder[]{
                post("/produtos/subcategorias"), put("/produtos/subcategorias/" + subB)})
            mvc.perform(request.header("Authorization", tokenB).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(Map.of("nome", "Inválido", "categoriaId", cat)))).andExpect(status().isNotFound());
        mvc.perform(get("/produtos/subcategorias").header("Authorization", tokenB).param("categoriaId", "" + cat))
            .andExpect(status().isNotFound());
        mvc.perform(get("/produtos/categorias").header("Authorization", tokenB))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1)).andExpect(jsonPath("$.items[0].nome").value("Outra"));
    }

    @ParameterizedTest @NullAndEmptySource @ValueSource(strings = {"   ", "beb"})
    void paginaBuscaEOrdenaSemVazarEmpresa(String termo) throws Exception {
        criar("categorias", tokenA, Map.of("nome", "Bebidas A"));
        criar("categorias", tokenA, Map.of("nome", "Bebidas B", "ativo", false));
        criar("categorias", tokenB, Map.of("nome", "Bebidas C"));
        var request = get("/produtos/categorias").header("Authorization", tokenA).param("size", "1").param("page", "1").param("sort", "nome,desc");
        if (termo != null) request.param("termo", termo);
        mvc.perform(request).andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(2))
            .andExpect(jsonPath("$.totalPages").value(2)).andExpect(jsonPath("$.items[0].nome").value("Bebidas A"));
        mvc.perform(get("/produtos/categorias").header("Authorization", tokenA).param("ativo", "false"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1)).andExpect(jsonPath("$.items[0].ativo").value(false));
    }

    @Test void filtraSubcategoriaPorPaiBuscaLiteralEValidaEntrada() throws Exception {
        long cat = criar("categorias", tokenA, Map.of("nome", "Pai"));
        long outro = criar("categorias", tokenA, Map.of("nome", "Outro"));
        criar("subcategorias", tokenA, Map.of("nome", "100% natural", "categoriaId", cat));
        criar("subcategorias", tokenA, Map.of("nome", "Comum", "categoriaId", outro));
        mvc.perform(get("/produtos/subcategorias").header("Authorization", tokenA).param("categoriaId", "" + cat).param("termo", "%"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1)).andExpect(jsonPath("$.items[0].categoria.id").value(cat));
        for (String body : new String[]{"{}", "{\"nome\":\"  \"}", "{\"nome\":\"" + "x".repeat(101) + "\"}"})
            mvc.perform(post("/produtos/categorias").header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        mvc.perform(post("/produtos/subcategorias").header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON).content("{\"nome\":\"Sem pai\"}"))
            .andExpect(status().isBadRequest());
        for (String query : new String[]{"?page=-1", "?size=101", "?sort=empresaId,asc", "?sort=nome,errado"})
            mvc.perform(get("/produtos/categorias" + query).header("Authorization", tokenA)).andExpect(status().isBadRequest());
        mvc.perform(get("/produtos/categorias")).andExpect(status().isUnauthorized());
        mvc.perform(get("/produtos/subcategorias")).andExpect(status().isUnauthorized());
    }

    long criar(String recurso, String token, Map<String, Object> body) throws Exception {
        var result = mvc.perform(post("/produtos/" + recurso).header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(body))).andExpect(status().isCreated()).andReturn();
        return json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    }
    void duplicado(String recurso, Long id, Map<String, Object> body) throws Exception {
        mvc.perform((id == null ? post("/produtos/" + recurso) : put("/produtos/" + recurso + "/" + id))
            .header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(body))).andExpect(status().isConflict());
    }
    private EmpresaEntity empresa(String nome) {
        var e = new EmpresaEntity(); e.setRazaoSocial(nome); e.setAtivo(true); return empresas.saveAndFlush(e);
    }
    private String token(EmpresaEntity empresa, String cpf, PerfilUsuario perfil) {
        var u = new UsuarioEntity(); u.setEmpresa(empresa); u.setCpf(cpf); u.setNomeUsuario("Teste"); u.setSenha("hash"); u.setAtivo(true); u.setPerfil(perfil);
        return "Bearer " + jwt.gerarToken(usuarios.saveAndFlush(u));
    }
}
