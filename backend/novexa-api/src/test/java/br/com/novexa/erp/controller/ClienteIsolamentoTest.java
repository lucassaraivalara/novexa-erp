package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.ClienteEntity;
import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.entity.PerfilUsuario;
import br.com.novexa.erp.entity.TipoPessoa;
import br.com.novexa.erp.repository.ClienteRepository;
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
        "spring.datasource.url=jdbc:h2:mem:cliente-isolamento;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
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
class ClienteIsolamentoTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private EmpresaRepository empresas;
    @Autowired private ClienteRepository clientes;
    @Autowired private JwtService jwtService;
    @Autowired private EntityManager entityManager;

    private EmpresaEntity empresaA;
    private EmpresaEntity empresaB;
    private ClienteEntity clienteA;
    private ClienteEntity clienteB;
    private String authorization;

    @BeforeEach
    void preparar() {
        empresaA = empresa("Empresa A", "11222333000181");
        empresaB = empresa("Empresa B", "12345678000190");
        clienteA = cliente(empresaA);
        clienteB = cliente(empresaB);
        authorization = "Bearer " + jwtService.gerarToken(1L, "02360684663", empresaA.getId(), PerfilUsuario.USUARIO);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void listarSomenteClientesDaEmpresaAutenticada(boolean informarOutraEmpresa) throws Exception {
        var request = get("/clientes").header(HttpHeaders.AUTHORIZATION, authorization);
        if (informarOutraEmpresa) request.param("empresaId", empresaB.getId().toString());

        mvc.perform(request).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(clienteA.getId()))
                .andExpect(jsonPath("$[0].empresaId").value(empresaA.getId()));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void cadastrarNaEmpresaAutenticadaMesmoComEmpresaForjadaNoBody(boolean informarOutraEmpresa) throws Exception {
        Map<String, Object> dados = dados();
        if (informarOutraEmpresa) dados.put("empresaId", empresaB.getId());

        var resultado = mvc.perform(post("/clientes").header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dados)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.empresaId").value(empresaA.getId()))
                .andReturn();

        Long id = json.readTree(resultado.getResponse().getContentAsString()).get("id").asLong();
        entityManager.flush();
        entityManager.clear();
        assertThat(clientes.findById(id).orElseThrow().getEmpresa().getId()).isEqualTo(empresaA.getId());
        assertThat(clientes.findAllByEmpresaIdOrderByNomeAsc(empresaB.getId())).hasSize(1);
    }

    @ParameterizedTest
    @CsvSource({"GET,false", "GET,true", "PUT,false", "PUT,true", "DELETE,false", "DELETE,true"})
    void naoPermitirAcessoOuAlteracaoDeClienteDaOutraEmpresa(String metodo, boolean informarOutraEmpresa) throws Exception {
        var request = request(HttpMethod.valueOf(metodo), "/clientes/" + clienteB.getId())
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
        ClienteEntity preservado = clientes.findById(clienteB.getId()).orElseThrow();
        assertThat(preservado.getNome()).isEqualTo("Cliente de teste");
        assertThat(preservado.getAtivo()).isTrue();
        assertThat(preservado.getCpfCnpj()).isEqualTo("02360684663");
        assertThat(preservado.getEmpresa().getId()).isEqualTo(empresaB.getId());
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void consultarAtualizarEInativarClienteProprioSemTrocarEmpresa(boolean informarOutraEmpresa) throws Exception {
        String url = "/clientes/" + clienteA.getId();
        mvc.perform(get(url).header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(clienteA.getId()));

        Map<String, Object> dados = dados();
        if (informarOutraEmpresa) dados.put("empresaId", empresaB.getId());
        mvc.perform(put(url).header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dados)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nome").value("Cliente alterado"))
                .andExpect(jsonPath("$.empresaId").value(empresaA.getId()));

        mvc.perform(delete(url).header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isNoContent());
        entityManager.flush();
        entityManager.clear();
        ClienteEntity salvo = clientes.findById(clienteA.getId()).orElseThrow();
        assertThat(salvo.getAtivo()).isFalse();
        assertThat(salvo.getNome()).isEqualTo("Cliente alterado");
        assertThat(salvo.getEmpresa().getId()).isEqualTo(empresaA.getId());
    }

    @ParameterizedTest
    @CsvSource({"GET,/clientes", "GET,/clientes/1", "POST,/clientes", "PUT,/clientes/1", "DELETE,/clientes/1"})
    void todosOsEndpointsExigemAutenticacao(String metodo, String url) throws Exception {
        mvc.perform(request(HttpMethod.valueOf(metodo), url)).andExpect(status().isUnauthorized());
        assertThat(clientes.count()).isEqualTo(2);
    }

    private Map<String, Object> dados() {
        return new HashMap<>(Map.of("nome", "Cliente alterado", "tipoPessoa", "FISICA", "cpfCnpj", "529.982.247-25"));
    }

    private EmpresaEntity empresa(String nome, String cnpj) {
        EmpresaEntity empresa = new EmpresaEntity();
        empresa.setRazaoSocial(nome);
        empresa.setCnpj(cnpj);
        empresa.setAtivo(true);
        return empresas.saveAndFlush(empresa);
    }

    private ClienteEntity cliente(EmpresaEntity empresa) {
        ClienteEntity cliente = new ClienteEntity();
        cliente.setEmpresa(empresa);
        cliente.setNome("Cliente de teste");
        cliente.setTipoPessoa(TipoPessoa.FISICA);
        cliente.setCpfCnpj("02360684663");
        return clientes.saveAndFlush(cliente);
    }
}
