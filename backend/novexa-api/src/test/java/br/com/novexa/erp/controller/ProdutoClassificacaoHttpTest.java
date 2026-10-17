package br.com.novexa.erp.controller;

import org.junit.jupiter.api.*;
import org.springframework.http.MediaType;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ProdutoClassificacaoHttpTest extends ProdutoFornecedorHttpTest {
    long categoriaA, categoriaA2, subA, subA2, marcaA, categoriaB, subB, marcaB;
    @BeforeEach void classificacoes() throws Exception {
        categoriaA = cadastro(tokenA, "categorias", Map.of("nome", "Categoria A"));
        categoriaA2 = cadastro(tokenA, "categorias", Map.of("nome", "Categoria A2"));
        subA = cadastro(tokenA, "subcategorias", Map.of("nome", "Sub A", "categoriaId", categoriaA));
        subA2 = cadastro(tokenA, "subcategorias", Map.of("nome", "Sub A2", "categoriaId", categoriaA2));
        marcaA = cadastro(tokenA, "marcas", Map.of("nome", "Marca A"));
        categoriaB = cadastro(tokenB, "categorias", Map.of("nome", "Categoria B"));
        subB = cadastro(tokenB, "subcategorias", Map.of("nome", "Sub B", "categoriaId", categoriaB));
        marcaB = cadastro(tokenB, "marcas", Map.of("nome", "Marca B"));
    }
    @Test void criaConsultaEditaPreservaOmitidosERemoveComNull() throws Exception {
        long legado = criar(tokenA, Map.of());
        mvc.perform(get("/produtos/" + legado).header("Authorization", tokenA)).andExpect(status().isOk())
            .andExpect(jsonPath("$.categoria").isEmpty()).andExpect(jsonPath("$.subcategoria").isEmpty()).andExpect(jsonPath("$.marca").isEmpty());
        long id = criar(tokenA, Map.of("categoriaId", categoriaA, "subcategoriaId", subA, "marcaId", marcaA));
        mvc.perform(put("/produtos/" + id).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(dados(Map.of("nome", "Editado", "categoriaInformada", true, "marca", Map.of("id", marcaB))))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.categoria.id").value(categoriaA))
            .andExpect(jsonPath("$.subcategoria.id").value(subA)).andExpect(jsonPath("$.marca.id").value(marcaA));
        var alterados = dados(Map.of("categoriaId", categoriaA2, "subcategoriaId", subA2));
        mvc.perform(put("/produtos/" + id).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(alterados)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.categoria.id").value(categoriaA2)).andExpect(jsonPath("$.subcategoria.id").value(subA2));
        for (String campo : new String[]{"categoriaId", "subcategoriaId", "marcaId"}) alterados.put(campo, null);
        mvc.perform(put("/produtos/" + id).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(alterados)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.categoria").isEmpty()).andExpect(jsonPath("$.subcategoria").isEmpty()).andExpect(jsonPath("$.marca").isEmpty());
        em.flush(); em.clear(); var produto = produtos.findById(id).orElseThrow();
        assertThat(produto.getCategoria()).isNull(); assertThat(produto.getSubcategoria()).isNull(); assertThat(produto.getMarca()).isNull();
        assertThat(produto.getEstoqueAtual()).isEqualByComparingTo("0");
    }
    @Test void rejeitaReferenciasDeOutraEmpresa() throws Exception {
        for (var referencia : Map.of("categoriaId", categoriaB, "subcategoriaId", subB, "marcaId", marcaB, "fornecedorId", fornecedorB).entrySet()) {
            mvc.perform(post("/produtos").header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(dados(Map.of(referencia.getKey(), referencia.getValue()))))).andExpect(status().isNotFound());
        }
        assertThat(produtos.count()).isZero();
    }
    @Test void exigeCategoriaCorretaEPreservaSubcategoriaOmitidaSemApagarSilenciosamente() throws Exception {
        for (var campos : java.util.List.of(Map.of("subcategoriaId", subA), Map.of("categoriaId", categoriaA2, "subcategoriaId", subA)))
            mvc.perform(post("/produtos").header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(dados(new java.util.HashMap<>(campos))))).andExpect(status().isBadRequest());
        long id = criar(tokenA, Map.of("categoriaId", categoriaA, "subcategoriaId", subA));
        mvc.perform(put("/produtos/" + id).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(dados(Map.of("categoriaId", categoriaA2))))).andExpect(status().isBadRequest());
        mvc.perform(get("/produtos/" + id).header("Authorization", tokenA)).andExpect(status().isOk()).andExpect(jsonPath("$.subcategoria.id").value(subA));
    }
    @Test void filtraNoBancoAntesDaPaginacaoComOrdenacaoEIsolamento() throws Exception {
        for (int i=0;i<7;i++) criar(tokenA, Map.of("nome", "Produto 0"+i, "categoriaId", categoriaA, "subcategoriaId", subA, "marcaId", marcaA));
        criar(tokenA, Map.of("categoriaId", categoriaA2, "subcategoriaId", subA2)); criar(tokenB, Map.of("marcaId", marcaB)); criar(tokenA, Map.of());
        em.flush(); em.clear();
        var stats = em.getEntityManagerFactory().unwrap(org.hibernate.SessionFactory.class).getStatistics(); stats.clear();
        mvc.perform(get("/produtos").header("Authorization", tokenA).param("categoriaId", ""+categoriaA).param("subcategoriaId", ""+subA)
            .param("marcaId", ""+marcaA).param("size", "3").param("page", "1").param("sort", "nome,desc"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(7)).andExpect(jsonPath("$.totalPages").value(3))
            .andExpect(jsonPath("$.items[0].nome").value("Produto 03")).andExpect(jsonPath("$.items[0].subcategoria.categoria.id").value(categoriaA));
        for (var tipo : new Class<?>[]{br.com.novexa.erp.entity.CategoriaProdutoEntity.class, br.com.novexa.erp.entity.SubcategoriaProdutoEntity.class, br.com.novexa.erp.entity.MarcaEntity.class}) assertThat(stats.getEntityStatistics(tipo.getName()).getFetchCount()).isZero();
        mvc.perform(get("/produtos").header("Authorization", tokenA).param("subcategoriaId", ""+subA)).andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(7));
        mvc.perform(get("/produtos").header("Authorization", tokenB)).andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1));
        for (var filtro : Map.of("categoriaId", categoriaB, "subcategoriaId", subB, "marcaId", marcaB).entrySet())
            mvc.perform(get("/produtos").header("Authorization", tokenA).param(filtro.getKey(), ""+filtro.getValue())).andExpect(status().isNotFound());
    }
    long cadastro(String token, String recurso, Map<String,Object> dados) throws Exception {
        var r=mvc.perform(post("/produtos/"+recurso).header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(dados))).andExpect(status().isCreated()).andReturn();
        return json.readTree(r.getResponse().getContentAsString()).get("id").asLong();
    }
}
