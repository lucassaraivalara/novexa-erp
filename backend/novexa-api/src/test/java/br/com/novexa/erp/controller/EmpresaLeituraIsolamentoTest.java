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
    @Autowired br.com.novexa.erp.repository.UsuarioRepository usuarios;

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
        authorization = br.com.novexa.erp.support.AutenticacaoTeste.token(usuarios, jwtService, empresaA, PerfilUsuario.USUARIO, "02360684663");
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
    @ValueSource(strings = {"/empresas", "/empresas/1", "/empresas/pagina"})
    void leiturasExigemAutenticacao(String url) throws Exception {
        mvc.perform(get(url)).andExpect(status().isUnauthorized());
    }

    @org.junit.jupiter.api.Test
    void paginaFiltraNoBancoSemAmpliarAcessoAoTenant() throws Exception {
        mvc.perform(get("/empresas/pagina").header(HttpHeaders.AUTHORIZATION, authorization)
                        .param("page", "0").param("size", "1").param("sort", "id,desc")
                        .param("ativo", "true").param("termo", "empresa a")
                        .param("empresaId", empresaB.getId().toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(empresaA.getId()))
                .andExpect(jsonPath("$.totalItems").value(1)).andExpect(jsonPath("$.totalPages").value(1))
                .andExpect(jsonPath("$.page").value(0)).andExpect(jsonPath("$.size").value(1));
        mvc.perform(get("/empresas/pagina").header(HttpHeaders.AUTHORIZATION, authorization).param("page", "1").param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(0))
                .andExpect(jsonPath("$.totalItems").value(1));
        for (var termo : new String[]{"Empresa B", "12345678000190"})
            mvc.perform(get("/empresas/pagina").header(HttpHeaders.AUTHORIZATION, authorization).param("termo", termo))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(0));
    }

    @org.junit.jupiter.api.Test
    void paginaBuscaDocumentoMascaradoFantasiaESituacao() throws Exception {
        empresaA.setNomeFantasia("Loja Teste"); empresas.saveAndFlush(empresaA);
        for (var termo : new String[]{"11.222.333/0001-81", "loja teste"})
            mvc.perform(get("/empresas/pagina").header(HttpHeaders.AUTHORIZATION, authorization).param("termo", termo))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1));
        mvc.perform(get("/empresas/pagina").header(HttpHeaders.AUTHORIZATION, authorization).param("ativo", "false"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(0));
    }

    @ParameterizedTest
    @ValueSource(strings = {"cnpj,desc", "razaoSocial,asc", "nomeFantasia,desc", "ativo,asc"})
    void paginaAceitaCamposPermitidos(String sort) throws Exception {
        mvc.perform(get("/empresas/pagina").header(HttpHeaders.AUTHORIZATION, authorization).param("sort", sort))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(empresaA.getId()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"cadastro.uf,asc", "razaoSocial,xxx", "id", "id,asc,desc"})
    void paginaRejeitaOrdenacaoInvalida(String sort) throws Exception {
        mvc.perform(get("/empresas/pagina").header(HttpHeaders.AUTHORIZATION, authorization).param("sort", sort))
                .andExpect(status().isBadRequest());
    }

    private EmpresaEntity empresa(String nome, String cnpj) {
        EmpresaEntity empresa = new EmpresaEntity();
        empresa.setRazaoSocial(nome);
        empresa.setCnpj(cnpj);
        empresa.setAtivo(true);
        return empresas.saveAndFlush(empresa);
    }
}
