package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.FornecedorEntity;
import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.entity.PerfilUsuario;
import br.com.novexa.erp.repository.FornecedorRepository;
import br.com.novexa.erp.repository.EmpresaRepository;
import br.com.novexa.erp.service.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
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

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// Mantém a cadeia JWT e as consultas reais, com duas empresas em um banco exclusivo do teste.
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:fornecedor-isolamento;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
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
class FornecedorIsolamentoTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private EmpresaRepository empresas;
    @Autowired private FornecedorRepository fornecedores;
    @Autowired private JwtService jwtService;
    @Autowired private EntityManager entityManager;

    private EmpresaEntity empresaA;
    private EmpresaEntity empresaB;
    private FornecedorEntity fornecedorA;
    private FornecedorEntity fornecedorB;
    private String authorization;

    @BeforeEach
    void preparar() {
        empresaA = empresa("Empresa A", "11222333000181");
        empresaB = empresa("Empresa B", "12345678000190");
        fornecedorA = fornecedor(empresaA);
        fornecedorB = fornecedor(empresaB);
        authorization = "Bearer " + jwtService.gerarToken(1L, "02360684663", empresaA.getId(), PerfilUsuario.USUARIO);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void listarSomenteFornecedoresDaEmpresaAutenticada(boolean informarOutraEmpresa) throws Exception {
        var request = get("/fornecedores").header(HttpHeaders.AUTHORIZATION, authorization);
        if (informarOutraEmpresa) request.param("empresaId", empresaB.getId().toString());

        mvc.perform(request).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(fornecedorA.getId()))
                .andExpect(jsonPath("$[0].empresaId").value(empresaA.getId()));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void cadastrarNaEmpresaAutenticadaMesmoComEmpresaForjadaNoBody(boolean informarOutraEmpresa) throws Exception {
        Map<String, Object> dados = dados();
        if (informarOutraEmpresa) dados.put("empresaId", empresaB.getId());

        var resultado = mvc.perform(post("/fornecedores").header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dados)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.empresaId").value(empresaA.getId()))
                .andReturn();

        Long id = json.readTree(resultado.getResponse().getContentAsString()).get("id").asLong();
        entityManager.flush();
        entityManager.clear();
        assertThat(fornecedores.findById(id).orElseThrow().getEmpresa().getId()).isEqualTo(empresaA.getId());
        assertThat(fornecedores.findAllByEmpresaIdOrderByRazaoSocialAsc(empresaB.getId())).hasSize(1);
    }

    @ParameterizedTest
    @CsvSource({"GET,false", "GET,true", "PUT,false", "PUT,true", "DELETE,false", "DELETE,true"})
    void naoPermitirAcessoOuAlteracaoDeFornecedorDaOutraEmpresa(String metodo, boolean informarOutraEmpresa) throws Exception {
        var request = request(HttpMethod.valueOf(metodo), "/fornecedores/" + fornecedorB.getId())
                .header(HttpHeaders.AUTHORIZATION, authorization);
        Map<String, Object> dados = dados();
        if (informarOutraEmpresa) {
            request.param("empresaId", empresaB.getId().toString());
            dados.put("empresaId", empresaB.getId());
        }
        if (metodo.equals("PUT")) {
            request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dados));
        }

        mvc.perform(request).andExpect(status().isNotFound());

        entityManager.flush();
        entityManager.clear();
        FornecedorEntity preservado = fornecedores.findById(fornecedorB.getId()).orElseThrow();
        assertThat(preservado.getRazaoSocial()).isEqualTo("Fornecedor de teste");
        assertThat(preservado.getAtivo()).isTrue();
        assertThat(preservado.getCpfCnpj()).isEqualTo("02360684663");
        assertThat(preservado.getEmpresa().getId()).isEqualTo(empresaB.getId());
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void consultarAtualizarEInativarFornecedorProprioSemTrocarEmpresa(boolean informarOutraEmpresa) throws Exception {
        String url = "/fornecedores/" + fornecedorA.getId();
        mvc.perform(get(url).header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(fornecedorA.getId()));

        Map<String, Object> dados = dados();
        if (informarOutraEmpresa) dados.put("empresaId", empresaB.getId());
        mvc.perform(put(url).header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dados)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.razaoSocial").value("Fornecedor alterado"))
                .andExpect(jsonPath("$.empresaId").value(empresaA.getId()));

        mvc.perform(delete(url).header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isNoContent());
        entityManager.flush();
        entityManager.clear();
        FornecedorEntity salvo = fornecedores.findById(fornecedorA.getId()).orElseThrow();
        assertThat(salvo.getAtivo()).isFalse();
        assertThat(salvo.getRazaoSocial()).isEqualTo("Fornecedor alterado");
        assertThat(salvo.getEmpresa().getId()).isEqualTo(empresaA.getId());
    }

    @ParameterizedTest
    @CsvSource({"GET,/fornecedores", "GET,/fornecedores/1", "POST,/fornecedores", "PUT,/fornecedores/1", "DELETE,/fornecedores/1"})
    void todosOsEndpointsExigemAutenticacao(String metodo, String url) throws Exception {
        mvc.perform(request(HttpMethod.valueOf(metodo), url)).andExpect(status().isUnauthorized());
        assertThat(fornecedores.count()).isEqualTo(2);
    }

    private Map<String, Object> dados() {
        return new HashMap<>(Map.of("razaoSocial", "Fornecedor alterado", "cpfCnpj", "529.982.247-25"));
    }

    private EmpresaEntity empresa(String nome, String cnpj) {
        EmpresaEntity empresa = new EmpresaEntity();
        empresa.setRazaoSocial(nome);
        empresa.setCnpj(cnpj);
        empresa.setAtivo(true);
        return empresas.saveAndFlush(empresa);
    }

    private FornecedorEntity fornecedor(EmpresaEntity empresa) {
        FornecedorEntity fornecedor = new FornecedorEntity();
        fornecedor.setEmpresa(empresa);
        fornecedor.setRazaoSocial("Fornecedor de teste");
        fornecedor.setCpfCnpj("02360684663");
        return fornecedores.saveAndFlush(fornecedor);
    }
}
