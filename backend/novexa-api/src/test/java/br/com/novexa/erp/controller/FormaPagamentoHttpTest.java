package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.PerfilUsuario;
import br.com.novexa.erp.service.JwtService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:formas-http;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver", "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false", "spring.jpa.show-sql=false",
        "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=60000"
})
@AutoConfigureMockMvc
@Transactional
@Sql("/formas-pagamento-fixture.sql")
class FormaPagamentoHttpTest {
    @Autowired br.com.novexa.erp.repository.EmpresaRepository empresas;
    @Autowired br.com.novexa.erp.repository.UsuarioRepository usuarios;
    private static final String URL = "/financeiro/formas-pagamento";
    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;

    @Test
    void leituraDoCatalogoContinuaGlobalECompativel() throws Exception {
        for (long empresa : new long[]{1L, 2L}) {
            String token = br.com.novexa.erp.support.AutenticacaoTeste.token(empresas, usuarios, jwt, PerfilUsuario.USUARIO,
                    empresa == 1 ? "02360684663" : "11144477735");
            mvc.perform(get(URL).header(HttpHeaders.AUTHORIZATION, token)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(6));
            mvc.perform(get(URL + "/2").header(HttpHeaders.AUTHORIZATION, token)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.tipo").value("PIX")).andExpect(jsonPath("$.empresaId").doesNotExist());
            mvc.perform(get(URL + "/999").header(HttpHeaders.AUTHORIZATION, token)).andExpect(status().isNotFound());
        }
    }

    @ParameterizedTest
    @EnumSource(PerfilUsuario.class)
    void perfisEmpresariaisNaoAlteramCatalogoGlobal(PerfilUsuario perfil) throws Exception {
        String token = br.com.novexa.erp.support.AutenticacaoTeste.token(empresas, usuarios, jwt, perfil, "02360684663");
        mvc.perform(post(URL).header(HttpHeaders.AUTHORIZATION, token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"descricao\":\"PIX Alternativo\",\"tipo\":\"PIX\"}")).andExpect(status().isForbidden());
        mvc.perform(put(URL + "/2").header(HttpHeaders.AUTHORIZATION, token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"descricao\":\"PIX Alterado\",\"tipo\":\"PIX\",\"ativo\":false}"))
                .andExpect(status().isForbidden());
        mvc.perform(get(URL).header(HttpHeaders.AUTHORIZATION, token)).andExpect(jsonPath("$.length()").value(6));
        mvc.perform(get(URL + "/2").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(jsonPath("$.descricao").value("PIX")).andExpect(jsonPath("$.ativo").value(true));
    }

    @Test
    void endpointsExigemAutenticacao() throws Exception {
        mvc.perform(get(URL)).andExpect(status().isUnauthorized());
        mvc.perform(get(URL + "/1")).andExpect(status().isUnauthorized());
        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(put(URL + "/1").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }
}
