package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.entity.PerfilUsuario;
import br.com.novexa.erp.entity.ProdutoEntity;
import br.com.novexa.erp.repository.EmpresaRepository;
import br.com.novexa.erp.repository.ProdutoRepository;
import br.com.novexa.erp.service.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// Exercita o filtro JWT, controller, service e consultas reais com duas empresas em banco isolado.
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:produto-isolamento;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
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
class ProdutoIsolamentoTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private EmpresaRepository empresas;
    @Autowired private ProdutoRepository produtos;
    @Autowired private JwtService jwtService;
    @Autowired private EntityManager entityManager;

    private EmpresaEntity empresa1;
    private EmpresaEntity empresa2;
    private ProdutoEntity produto1;
    private ProdutoEntity produto2;
    private String authorization;

    @BeforeEach
    void preparar() {
        empresa1 = empresa("Empresa 1", "11222333000181");
        empresa2 = empresa("Empresa 2", "12345678000190");
        produto1 = produto(empresa1);
        produto2 = produto(empresa2);
        authorization = "Bearer " + jwtService.gerarToken(1L, "02360684663", empresa1.getId(), PerfilUsuario.USUARIO);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void listarSomenteProdutosDaEmpresaAutenticada(boolean informarOutraEmpresa) throws Exception {
        var request = get("/produtos").header(HttpHeaders.AUTHORIZATION, authorization);
        if (informarOutraEmpresa) request.param("empresaId", empresa2.getId().toString());

        mvc.perform(request).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(produto1.getId()))
                .andExpect(jsonPath("$[0].empresaId").value(empresa1.getId()));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void cadastrarNaEmpresaAutenticadaMesmoComEmpresaForjadaNoBody(boolean informarOutraEmpresa) throws Exception {
        Map<String, Object> dados = dados();
        if (informarOutraEmpresa) dados.put("empresaId", empresa2.getId());

        var resultado = mvc.perform(post("/produtos").header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dados)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.empresaId").value(empresa1.getId()))
                .andReturn();

        Long id = json.readTree(resultado.getResponse().getContentAsString()).get("id").asLong();
        entityManager.flush();
        entityManager.clear();
        assertThat(produtos.findById(id).orElseThrow().getEmpresa().getId()).isEqualTo(empresa1.getId());
        assertThat(produtos.findAllByEmpresaIdOrderByNomeAsc(empresa2.getId())).hasSize(1);
    }

    @ParameterizedTest
    @ValueSource(strings = {"Produto", "SKU-001", "7891234567890", " "})
    void buscarPorTermoMantemEscopoDaEmpresaEmTodasAsConsultas(String termo) throws Exception {
        mvc.perform(get("/produtos/buscar").param("termo", termo)
                        .param("empresaId", empresa2.getId().toString())
                        .header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(produto1.getId()));
    }

    @ParameterizedTest
    @CsvSource({"GET,false", "GET,true", "PUT,false", "PUT,true", "DELETE,false", "DELETE,true"})
    void naoPermitirAcessoOuAlteracaoDeProdutoDaOutraEmpresa(String metodo, boolean informarOutraEmpresa) throws Exception {
        var request = request(HttpMethod.valueOf(metodo), "/produtos/" + produto2.getId())
                .header(HttpHeaders.AUTHORIZATION, authorization);
        Map<String, Object> dados = dados();
        if (informarOutraEmpresa) {
            request.param("empresaId", empresa2.getId().toString());
            dados.put("empresaId", empresa2.getId());
        }
        if (metodo.equals("PUT")) {
            request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dados));
        }

        mvc.perform(request).andExpect(status().isNotFound());

        entityManager.flush();
        entityManager.clear();
        ProdutoEntity preservado = produtos.findById(produto2.getId()).orElseThrow();
        assertThat(preservado.getNome()).isEqualTo("Produto de teste");
        assertThat(preservado.getAtivo()).isTrue();
        assertThat(preservado.getPrecoVenda()).isEqualByComparingTo("19.90");
        assertThat(preservado.getEmpresa().getId()).isEqualTo(empresa2.getId());
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void consultarAtualizarEInativarProdutoProprioSemTrocarEmpresa(boolean informarOutraEmpresa) throws Exception {
        String url = "/produtos/" + produto1.getId();
        mvc.perform(get(url).header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(produto1.getId()));

        Map<String, Object> dados = dados();
        if (informarOutraEmpresa) dados.put("empresaId", empresa2.getId());
        mvc.perform(put(url).header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dados)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nome").value("Produto alterado"))
                .andExpect(jsonPath("$.empresaId").value(empresa1.getId()));

        mvc.perform(delete(url).header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isNoContent());
        entityManager.flush();
        entityManager.clear();
        ProdutoEntity salvo = produtos.findById(produto1.getId()).orElseThrow();
        assertThat(salvo.getAtivo()).isFalse();
        assertThat(salvo.getNome()).isEqualTo("Produto alterado");
        assertThat(salvo.getEmpresa().getId()).isEqualTo(empresa1.getId());
    }

    @ParameterizedTest
    @CsvSource({"GET,/produtos", "GET,/produtos/buscar?termo=Produto", "GET,/produtos/1",
            "POST,/produtos", "PUT,/produtos/1", "DELETE,/produtos/1"})
    void todosOsEndpointsExigemJwtValido(String metodo, String url) throws Exception {
        mvc.perform(request(HttpMethod.valueOf(metodo), url)).andExpect(status().isUnauthorized());
        mvc.perform(request(HttpMethod.valueOf(metodo), url)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer token-invalido"))
                .andExpect(status().isUnauthorized());
        assertThat(produtos.count()).isEqualTo(2);
    }

    @Test
    void buscaPorTermoFuncionaSemParametroEmpresaId() throws Exception {
        mvc.perform(get("/produtos/buscar").param("termo", "Produto")
                        .header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(produto1.getId()));
    }

    private Map<String, Object> dados() {
        return new HashMap<>(Map.of("nome", "Produto alterado", "unidadeMedida", "UN", "precoVenda", 25));
    }

    private EmpresaEntity empresa(String nome, String cnpj) {
        EmpresaEntity empresa = new EmpresaEntity();
        empresa.setRazaoSocial(nome);
        empresa.setCnpj(cnpj);
        empresa.setAtivo(true);
        return empresas.saveAndFlush(empresa);
    }

    private ProdutoEntity produto(EmpresaEntity empresa) {
        ProdutoEntity produto = new ProdutoEntity();
        produto.setEmpresa(empresa);
        produto.setNome("Produto de teste");
        produto.setCodigoInterno("SKU-001");
        produto.setCodigoBarras("7891234567890");
        produto.setUnidadeMedida("UN");
        produto.setPrecoVenda(new BigDecimal("19.90"));
        return produtos.saveAndFlush(produto);
    }
}
