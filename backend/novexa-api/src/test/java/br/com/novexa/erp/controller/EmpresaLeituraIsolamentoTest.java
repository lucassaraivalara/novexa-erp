package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.entity.PerfilUsuario;
import br.com.novexa.erp.repository.EmpresaRepository;
import br.com.novexa.erp.service.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:empresa-leitura-isolamento;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
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
class EmpresaLeituraIsolamentoTest {

    @Autowired private MockMvc mvc;
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
    void listarSomenteEmpresaAutenticada(boolean informarOutraEmpresa) throws Exception {
        var request = get("/empresas").header(HttpHeaders.AUTHORIZATION, authorization);
        if (informarOutraEmpresa) request.param("empresaId", empresaB.getId().toString());

        mvc.perform(request).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(empresaA.getId()))
                .andExpect(jsonPath("$[0].razaoSocial").value("Empresa A"));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void consultarPropriaEmpresa(boolean informarOutraEmpresa) throws Exception {
        var request = get("/empresas/" + empresaA.getId())
                .header(HttpHeaders.AUTHORIZATION, authorization);
        if (informarOutraEmpresa) request.param("empresaId", empresaB.getId().toString());

        mvc.perform(request).andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(empresaA.getId()))
                .andExpect(jsonPath("$.razaoSocial").value("Empresa A"))
                .andExpect(jsonPath("$.cnpj").value(empresaA.getCnpj()));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void naoConsultarOutraEmpresa(boolean informarOutraEmpresa) throws Exception {
        var request = get("/empresas/" + empresaB.getId())
                .header(HttpHeaders.AUTHORIZATION, authorization);
        if (informarOutraEmpresa) request.param("empresaId", empresaB.getId().toString());

        mvc.perform(request).andExpect(status().isNotFound())
                .andExpect(content().string("Empresa não encontrada com o ID: " + empresaB.getId()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/empresas", "/empresas/1"})
    void leiturasExigemAutenticacao(String url) throws Exception {
        mvc.perform(get(url)).andExpect(status().isUnauthorized());
    }

    private EmpresaEntity empresa(String nome, String cnpj) {
        EmpresaEntity empresa = new EmpresaEntity();
        empresa.setRazaoSocial(nome);
        empresa.setCnpj(cnpj);
        empresa.setAtivo(true);
        return empresas.saveAndFlush(empresa);
    }
}
