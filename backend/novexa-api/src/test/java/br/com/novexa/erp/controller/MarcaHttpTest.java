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
import java.math.BigDecimal;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:marcas;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.username=sa", "spring.datasource.password=", "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false",
    "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=60000"
})
@AutoConfigureMockMvc
@Transactional
class MarcaHttpTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired MarcaRepository marcas;
    @Autowired ProdutoRepository produtos;
    @Autowired JwtService jwt;
    EmpresaEntity empresaA, empresaB;
    String tokenA, tokenB;

    @BeforeEach void preparar() {
        empresaA = empresa("A"); empresaB = empresa("B");
        tokenA = token(empresaA, "12345678909", PerfilUsuario.ADMIN);
        tokenB = token(empresaB, "52998224725", PerfilUsuario.OPERADOR);
    }

    @Test void crudNormalizaNomePreservaTenantEPermiteAtivarInativarExcluir() throws Exception {
        long id = criar(tokenA, Map.of("nome", " Marca teste ", "empresaId", empresaB.getId()));
        assertThat(marcas.findById(id).orElseThrow().getEmpresa().getId()).isEqualTo(empresaA.getId());
        mvc.perform(get("/produtos/marcas/" + id).header("Authorization", tokenA)).andExpect(status().isOk())
            .andExpect(jsonPath("$.nome").value("Marca teste")).andExpect(jsonPath("$.ativo").value(true));
        for (boolean ativo : new boolean[]{false, true})
            mvc.perform(put("/produtos/marcas/" + id).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(Map.of("nome", "Marca editada", "ativo", ativo))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ativo").value(ativo));
        mvc.perform(delete("/produtos/marcas/" + id).header("Authorization", tokenA)).andExpect(status().isNoContent());
        mvc.perform(get("/produtos/marcas/" + id).header("Authorization", tokenA)).andExpect(status().isNotFound());
    }

    @Test void rejeitaDuplicidadeInclusiveInativaMasPermiteMesmoNomeEmOutraEmpresa() throws Exception {
        criar(tokenA, Map.of("nome", "Acme", "ativo", false));
        criar(tokenB, Map.of("nome", "Acme"));
        long id = criar(tokenA, Map.of("nome", "Outra"));
        mvc.perform(post("/produtos/marcas").header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content("{\"nome\":\" ACME \"}")).andExpect(status().isConflict());
        mvc.perform(put("/produtos/marcas/" + id).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content("{\"nome\":\"acme\"}")).andExpect(status().isConflict());
        mvc.perform(put("/produtos/marcas/" + id).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content("{\"nome\":\"Outra\"}")).andExpect(status().isOk());
    }

    @Test void bloqueiaOperacoesDeOutraEmpresaENaoPermiteTrocarTenant() throws Exception {
        long id = criar(tokenA, Map.of("nome", "Privada"));
        mvc.perform(get("/produtos/marcas/" + id).header("Authorization", tokenB)).andExpect(status().isNotFound());
        mvc.perform(delete("/produtos/marcas/" + id).header("Authorization", tokenB)).andExpect(status().isNotFound());
        mvc.perform(put("/produtos/marcas/" + id).header("Authorization", tokenB).contentType(MediaType.APPLICATION_JSON)
            .content("{\"nome\":\"Inválida\"}")).andExpect(status().isNotFound());
        mvc.perform(get("/produtos/marcas").header("Authorization", tokenB).param("empresaId", empresaA.getId().toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(0));
        mvc.perform(put("/produtos/marcas/" + id).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(Map.of("nome", "Editada", "empresaId", empresaB.getId())))).andExpect(status().isOk());
        assertThat(marcas.findById(id).orElseThrow().getEmpresa().getId()).isEqualTo(empresaA.getId());
    }

    @ParameterizedTest @NullAndEmptySource @ValueSource(strings = {"   ", " MAR "})
    void buscaPaginacaoOrdenacaoESituacaoSaoAplicadasPorEmpresa(String termo) throws Exception {
        criar(tokenA, Map.of("nome", "Marca A")); criar(tokenA, Map.of("nome", "Marca B", "ativo", false));
        criar(tokenB, Map.of("nome", "Marca C"));
        var request = get("/produtos/marcas").header("Authorization", tokenA).param("page", "1").param("size", "1").param("sort", "nome,desc");
        if (termo != null) request.param("termo", termo);
        mvc.perform(request).andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(2))
            .andExpect(jsonPath("$.totalPages").value(2)).andExpect(jsonPath("$.items[0].nome").value("Marca A"));
        mvc.perform(get("/produtos/marcas").header("Authorization", tokenA).param("ativo", "false"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1)).andExpect(jsonPath("$.items[0].nome").value("Marca B"));
    }

    @Test void validaNomeParametrosEAutenticacaoEBuscaCaracteresLiterais() throws Exception {
        criar(tokenA, Map.of("nome", "100%_!")); criar(tokenA, Map.of("nome", "Comum"));
        for (String termo : new String[]{"%", "_", "!"})
            mvc.perform(get("/produtos/marcas").header("Authorization", tokenA).param("termo", termo))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1));
        for (String body : new String[]{"{}", "{\"nome\":null}", "{\"nome\":\"  \"}", "{\"nome\":\"" + "x".repeat(101) + "\"}"})
            mvc.perform(post("/produtos/marcas").header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        for (String query : new String[]{"?page=-1", "?size=101", "?sort=empresaId,asc", "?sort=nome,errado"})
            mvc.perform(get("/produtos/marcas" + query).header("Authorization", tokenA)).andExpect(status().isBadRequest());
        mvc.perform(get("/produtos/marcas")).andExpect(status().isUnauthorized());
        mvc.perform(post("/produtos/marcas").contentType(MediaType.APPLICATION_JSON).content("{\"nome\":\"Sem sessão\"}"))
            .andExpect(status().isUnauthorized());
    }

    @ParameterizedTest @ValueSource(booleans = {true, false})
    void produtoVinculadoAtivoOuInativoBloqueiaExclusaoMasPermiteInativarMarca(boolean produtoAtivo) throws Exception {
        long id = criar(tokenA, Map.of("nome", "Vinculada"));
        ProdutoEntity produto = produto(empresaA, marcas.findById(id).orElseThrow(), produtoAtivo);
        mvc.perform(delete("/produtos/marcas/" + id).header("Authorization", tokenA)).andExpect(status().isConflict())
            .andExpect(content().string(org.hamcrest.Matchers.containsString("produtos vinculados")));
        mvc.perform(put("/produtos/marcas/" + id).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content("{\"nome\":\"Vinculada\",\"ativo\":false}")).andExpect(status().isOk());
        mvc.perform(put("/produtos/marcas/" + id).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content("{\"nome\":\"Renomeada\"}")).andExpect(status().isOk()).andExpect(jsonPath("$.ativo").value(false));
        assertThat(produtos.findById(produto.getId()).orElseThrow().getMarca().getId()).isEqualTo(id);
        long livre = criar(tokenB, Map.of("nome", "Vinculada"));
        mvc.perform(delete("/produtos/marcas/" + livre).header("Authorization", tokenB)).andExpect(status().isNoContent());
    }

    @Test void produtoExpoeMarcaEPreservaVinculoOmitidoAoEditar() throws Exception {
        long id = criar(tokenA, Map.of("nome", "Reservada"));
        var dados = Map.of("nome", "Produto", "unidadeMedida", "UN", "precoVenda", 10, "marcaId", id, "marca", Map.of("id", id));
        var resposta = mvc.perform(post("/produtos").header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(dados))).andExpect(status().isCreated())
            .andExpect(jsonPath("$.marcaId").doesNotExist()).andExpect(jsonPath("$.marca.id").value(id)).andReturn();
        long produtoId = json.readTree(resposta.getResponse().getContentAsString()).get("id").asLong();
        var produto = produtos.findById(produtoId).orElseThrow(); assertThat(produto.getMarca().getId()).isEqualTo(id);
        produto.setMarca(marcas.findById(id).orElseThrow()); produtos.saveAndFlush(produto);
        mvc.perform(put("/produtos/" + produtoId).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(Map.of("nome", "Editado", "unidadeMedida", "UN", "precoVenda", 20))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.marcaId").doesNotExist()).andExpect(jsonPath("$.marca.id").value(id));
        assertThat(produtos.findById(produtoId).orElseThrow().getMarca().getId()).isEqualTo(id);
    }

    long criar(String token, Map<String, Object> dados) throws Exception {
        var r = mvc.perform(post("/produtos/marcas").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(dados))).andExpect(status().isCreated()).andReturn();
        return json.readTree(r.getResponse().getContentAsString()).get("id").asLong();
    }
    ProdutoEntity produto(EmpresaEntity empresa, MarcaEntity marca, boolean ativo) {
        var p = new ProdutoEntity(); p.setEmpresa(empresa); p.setNome("Produto teste"); p.setUnidadeMedida("UN");
        p.setPrecoVenda(BigDecimal.TEN); p.setAtivo(ativo); p.setMarca(marca); return produtos.saveAndFlush(p);
    }
    private EmpresaEntity empresa(String nome) {
        var e = new EmpresaEntity(); e.setRazaoSocial(nome); e.setAtivo(true); return empresas.saveAndFlush(e);
    }
    private String token(EmpresaEntity empresa, String cpf, PerfilUsuario perfil) {
        var u = new UsuarioEntity(); u.setEmpresa(empresa); u.setCpf(cpf); u.setNomeUsuario("Teste"); u.setSenha("hash"); u.setAtivo(true); u.setPerfil(perfil);
        return "Bearer " + jwt.gerarToken(usuarios.saveAndFlush(u));
    }
}
