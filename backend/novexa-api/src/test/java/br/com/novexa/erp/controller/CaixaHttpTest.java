package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.CaixaEntity;
import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.entity.PerfilUsuario;
import br.com.novexa.erp.repository.CaixaRepository;
import br.com.novexa.erp.repository.EmpresaRepository;
import br.com.novexa.erp.service.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:caixa-http;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false",
        "spring.jpa.show-sql=false",
        "novexa.jwt.secret=01234567890123456789012345678901",
        "novexa.jwt.expiration-ms=60000"
})
@AutoConfigureMockMvc
@Transactional
class CaixaHttpTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private EmpresaRepository empresas;

    @Autowired
    private CaixaRepository caixas;

    @Autowired
    private JwtService jwt;

    @Autowired
    private EntityManager entityManager;

    private EmpresaEntity empresaA;
    private EmpresaEntity empresaB;
    private CaixaEntity caixaA;
    private CaixaEntity caixaB;
    private String authorizationA;

    @BeforeEach
    void preparar() {
        empresaA = empresa("Empresa A", "11222333000181");
        empresaB = empresa("Empresa B", "12345678000190");
        caixaA = caixa(empresaA, "Caixa A");
        caixaB = caixa(empresaB, "Caixa B");
        authorizationA = "Bearer " + jwt.gerarToken(
                1L,
                "02360684663",
                empresaA.getId(),
                PerfilUsuario.USUARIO
        );
    }

    @Test
    void cadastrarCaixaVinculadoAEmpresaAutenticada() throws Exception {
        var resultado = mvc.perform(post("/financeiro/caixas")
                        .header(HttpHeaders.AUTHORIZATION, authorizationA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of("descricao", "  Caixa Novo  "))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.descricao").value("Caixa Novo"))
                .andExpect(jsonPath("$.ativo").value(true))
                .andExpect(jsonPath("$.empresaId").doesNotExist())
                .andReturn();

        long id = json.readTree(resultado.getResponse().getContentAsString())
                .get("id")
                .asLong();

        entityManager.flush();
        entityManager.clear();
        assertThat(caixas.findById(id).orElseThrow().getEmpresa().getId())
                .isEqualTo(empresaA.getId());
    }

    @ParameterizedTest
    @CsvSource({"{}", "{\"descricao\":\"  \"}"})
    void descricaoEObrigatoria(String corpo) throws Exception {
        mvc.perform(post("/financeiro/caixas")
                        .header(HttpHeaders.AUTHORIZATION, authorizationA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejeitarDescricaoDuplicadaNaMesmaEmpresa() throws Exception {
        mvc.perform(post("/financeiro/caixas")
                        .header(HttpHeaders.AUTHORIZATION, authorizationA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of("descricao", "Caixa A"))))
                .andExpect(status().isConflict());
    }

    @Test
    void permitirMesmaDescricaoEmEmpresasDiferentes() throws Exception {
        mvc.perform(post("/financeiro/caixas")
                        .header(HttpHeaders.AUTHORIZATION, authorizationA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of("descricao", "Caixa B"))))
                .andExpect(status().isCreated());

        assertThat(caixas.findAllByEmpresaIdOrderByDescricaoAsc(empresaA.getId())).hasSize(2);
    }

    @Test
    void listarSomenteCaixasDaEmpresaAutenticada() throws Exception {
        mvc.perform(get("/financeiro/caixas")
                        .header(HttpHeaders.AUTHORIZATION, authorizationA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(caixaA.getId()));
    }

    @Test
    void buscarPorIdRespeitaEmpresa() throws Exception {
        mvc.perform(get("/financeiro/caixas/" + caixaA.getId())
                        .header(HttpHeaders.AUTHORIZATION, authorizationA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(caixaA.getId()));

        mvc.perform(get("/financeiro/caixas/" + caixaB.getId())
                        .header(HttpHeaders.AUTHORIZATION, authorizationA))
                .andExpect(status().isNotFound());
    }

    @ParameterizedTest
    @CsvSource({"GET", "PUT", "DELETE"})
    void empresaNaoAcessaCaixaDeOutraEmpresa(String metodo) throws Exception {
        String url = "/financeiro/caixas/" + caixaB.getId();
        var requisicao = request(HttpMethod.valueOf(metodo), url)
                .header(HttpHeaders.AUTHORIZATION, authorizationA);

        if ("PUT".equals(metodo)) {
            requisicao.contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsBytes(Map.of("descricao", "Caixa alterado")));
        }

        mvc.perform(requisicao).andExpect(status().isNotFound());

        entityManager.flush();
        entityManager.clear();
        assertThat(caixas.findById(caixaB.getId()).orElseThrow().getDescricao())
                .isEqualTo("Caixa B");
        assertThat(caixas.findById(caixaB.getId()).orElseThrow().getAtivo()).isTrue();
    }

    @Test
    void atualizarDescricaoDoCaixaProprio() throws Exception {
        mvc.perform(put("/financeiro/caixas/" + caixaA.getId())
                        .header(HttpHeaders.AUTHORIZATION, authorizationA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of("descricao", "Caixa atualizado"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.descricao").value("Caixa atualizado"))
                .andExpect(jsonPath("$.ativo").value(true));

        entityManager.flush();
        entityManager.clear();
        assertThat(caixas.findById(caixaA.getId()).orElseThrow().getDescricao())
                .isEqualTo("Caixa atualizado");
    }

    @Test
    void atualizacaoNaoPermiteDescricaoDuplicada() throws Exception {
        CaixaEntity outro = caixa(empresaA, "Caixa destino");

        mvc.perform(put("/financeiro/caixas/" + caixaA.getId())
                        .header(HttpHeaders.AUTHORIZATION, authorizationA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of("descricao", "Caixa destino"))))
                .andExpect(status().isConflict());

        entityManager.flush();
        entityManager.clear();
        assertThat(caixas.findById(caixaA.getId()).orElseThrow().getDescricao())
                .isEqualTo("Caixa A");
        assertThat(caixas.findById(outro.getId()).orElseThrow().getDescricao())
                .isEqualTo("Caixa destino");
    }

    @Test
    void inativacaoLogicaMantemCaixaPersistido() throws Exception {
        mvc.perform(delete("/financeiro/caixas/" + caixaA.getId())
                        .header(HttpHeaders.AUTHORIZATION, authorizationA))
                .andExpect(status().isNoContent());

        entityManager.flush();
        entityManager.clear();
        CaixaEntity persistido = caixas.findById(caixaA.getId()).orElseThrow();
        assertThat(persistido.getAtivo()).isFalse();
    }

    @Test
    void caixaInativadoContinuaDisponivelParaLeitura() throws Exception {
        caixas.findById(caixaA.getId()).orElseThrow().setAtivo(false);
        entityManager.flush();
        entityManager.clear();

        mvc.perform(get("/financeiro/caixas/" + caixaA.getId())
                        .header(HttpHeaders.AUTHORIZATION, authorizationA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ativo").value(false));
    }

    @ParameterizedTest
    @CsvSource({
            "GET,/financeiro/caixas",
            "GET,/financeiro/caixas/1",
            "POST,/financeiro/caixas",
            "PUT,/financeiro/caixas/1",
            "DELETE,/financeiro/caixas/1"
    })
    void endpointsExigemJwt(String metodo, String url) throws Exception {
        mvc.perform(request(HttpMethod.valueOf(metodo), url))
                .andExpect(status().isUnauthorized());
    }

    private EmpresaEntity empresa(String razaoSocial, String cnpj) {
        EmpresaEntity empresa = new EmpresaEntity();
        empresa.setRazaoSocial(razaoSocial);
        empresa.setCnpj(cnpj);
        empresa.setAtivo(true);
        return empresas.saveAndFlush(empresa);
    }

    private CaixaEntity caixa(EmpresaEntity empresa, String descricao) {
        CaixaEntity caixa = new CaixaEntity();
        caixa.setEmpresa(empresa);
        caixa.setDescricao(descricao);
        caixa.setAtivo(true);
        return caixas.saveAndFlush(caixa);
    }
}
