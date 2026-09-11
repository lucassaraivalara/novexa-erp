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
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:empresa-alteracao-isolamento;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
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
class EmpresaAlteracaoIsolamentoTest {

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

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void usuarioAutenticadoAtualizaPropriaEmpresa(boolean informarOutraEmpresa) throws Exception {
        var request = put("/empresas/" + empresaA.getId())
                .header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content(corpoPut());
        if (informarOutraEmpresa) request.param("empresaId", empresaB.getId().toString());

        mvc.perform(request).andExpect(status().isOk())
                .andExpect(jsonPath("$.razaoSocial").value("Empresa A Atualizada"));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void usuarioEmpresaANaoAtualizaEmpresaB(boolean informarOutraEmpresa) throws Exception {
        var request = put("/empresas/" + empresaB.getId())
                .header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content(corpoPut());
        if (informarOutraEmpresa) request.param("empresaId", empresaB.getId().toString());

        mvc.perform(request).andExpect(status().isNotFound())
                .andExpect(content().string("Empresa não encontrada com o ID: " + empresaB.getId()));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void usuarioAutenticadoInativaPropriaEmpresa(boolean informarOutraEmpresa) throws Exception {
        var request = delete("/empresas/" + empresaA.getId())
                .header(HttpHeaders.AUTHORIZATION, authorization);
        if (informarOutraEmpresa) request.param("empresaId", empresaB.getId().toString());

        mvc.perform(request).andExpect(status().isNoContent());
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void usuarioEmpresaANaoInativaEmpresaB(boolean informarOutraEmpresa) throws Exception {
        var request = delete("/empresas/" + empresaB.getId())
                .header(HttpHeaders.AUTHORIZATION, authorization);
        if (informarOutraEmpresa) request.param("empresaId", empresaB.getId().toString());

        mvc.perform(request).andExpect(status().isNotFound())
                .andExpect(content().string("Empresa não encontrada com o ID: " + empresaB.getId()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"PUT,/empresas/1", "DELETE,/empresas/1"})
    void alteracoesExigemAutenticacao(String metodoUrl) throws Exception {
        var partes = metodoUrl.split(",");
        String metodo = partes[0];
        String url = partes[1];

        mvc.perform(request(HttpMethod.valueOf(metodo), url))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void comportamentoLeituraB1ContinuaFuncionando() throws Exception {
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
