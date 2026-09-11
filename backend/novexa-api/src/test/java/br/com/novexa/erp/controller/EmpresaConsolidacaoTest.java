package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.EmpresaInscricaoStDTO;
import br.com.novexa.erp.dto.EmpresaRequestDTO;
import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.entity.EmpresaCadastroDados;
import br.com.novexa.erp.entity.PerfilUsuario;
import br.com.novexa.erp.entity.RegimeTributario;
import br.com.novexa.erp.repository.EmpresaRepository;
import br.com.novexa.erp.service.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:empresa-consolidacao;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
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
class EmpresaConsolidacaoTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private EmpresaRepository empresas;
    @Autowired private JwtService jwtService;

    private EmpresaEntity empresaA;
    private EmpresaEntity empresaB;
    private String authorization;

    @BeforeEach
    void preparar() {
        empresaA = empresa("Empresa A", "11222333000181");
        empresaB = empresa("Empresa B", "12345678000190");
        authorization = "Bearer " + jwtService.gerarToken(
                1L, "02360684663", empresaA.getId(), PerfilUsuario.USUARIO);
    }

    @Test
    void postExigeAutenticacao() throws Exception {
        mvc.perform(post("/empresas"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void usuarioAutenticadoCriaEmpresa() throws Exception {
        var resultado = mvc.perform(post("/empresas")
                        .header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoPost()))
                .andExpect(status().isCreated())
                .andReturn();

        Long novoId = json.readTree(resultado.getResponse().getContentAsString()).get("id").asLong();
    }

    @Test
    void criacaoNaoPermiteAcessoForaDoTenant() throws Exception {
        var resultado = mvc.perform(post("/empresas")
                        .header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoPost()))
                .andExpect(status().isCreated())
                .andReturn();

        Long novoId = json.readTree(resultado.getResponse().getContentAsString()).get("id").asLong();

        mvc.perform(get("/empresas").header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(empresaA.getId()));

        mvc.perform(get("/empresas/" + novoId).header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isNotFound());

        mvc.perform(put("/empresas/" + novoId)
                        .header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoPut()))
                .andExpect(status().isNotFound());

        mvc.perform(delete("/empresas/" + novoId).header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isNotFound());
    }

    @Test
    void leituraB1ContinuaFuncionando() throws Exception {
        mvc.perform(get("/empresas").header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(empresaA.getId()));

        mvc.perform(get("/empresas/" + empresaA.getId()).header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(empresaA.getId()));

        mvc.perform(get("/empresas/" + empresaB.getId()).header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isNotFound());
    }

    @ParameterizedTest
    @ValueSource(strings = {"PUT,/empresas/1", "DELETE,/empresas/1"})
    void alteracoesExigemAutenticacao(String metodoUrl) throws Exception {
        var partes = metodoUrl.split(",");
        String metodo = partes[0];
        String url = partes[1];

        mvc.perform(request(org.springframework.http.HttpMethod.valueOf(metodo), url))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void atualizacaoB2ContinuaFuncionando() throws Exception {
        mvc.perform(put("/empresas/" + empresaA.getId())
                        .header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoPut()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(empresaA.getId()));

        mvc.perform(put("/empresas/" + empresaB.getId())
                        .header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoPut()))
                .andExpect(status().isNotFound());
    }

    private String corpoPost() throws Exception {
        EmpresaRequestDTO dto = new EmpresaRequestDTO();
        dto.setRazaoSocial("Empresa C");
        dto.setCnpj("12.ABC.345/01DE-35");
        dto.setAtivo(true);
        var cadastro = new EmpresaCadastroDados();
        cadastro.setRegimeTributario(RegimeTributario.SIMPLES_NACIONAL);
        cadastro.setUf("SP");
        dto.setCadastro(cadastro);
        dto.setInscricoesSt(List.of(new EmpresaInscricaoStDTO("MG", "00123456", true)));
        return json.writeValueAsString(dto);
    }

    private String corpoPut() throws Exception {
        EmpresaRequestDTO dto = new EmpresaRequestDTO();
        dto.setRazaoSocial("Empresa A Atualizada");
        dto.setCnpj("11222333000181");
        dto.setAtivo(true);
        var cadastro = new EmpresaCadastroDados();
        cadastro.setRegimeTributario(RegimeTributario.LUCRO_PRESUMIDO);
        cadastro.setUf("SP");
        dto.setCadastro(cadastro);
        dto.setInscricoesSt(List.of(new EmpresaInscricaoStDTO("MG", "00123456", true)));
        return json.writeValueAsString(dto);
    }

    private EmpresaEntity empresa(String nome, String cnpj) {
        EmpresaEntity empresa = new EmpresaEntity();
        empresa.setRazaoSocial(nome);
        empresa.setCnpj(cnpj);
        empresa.setAtivo(true);
        return empresas.saveAndFlush(empresa);
    }
}
