package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.PerfilUsuario;
import br.com.novexa.erp.service.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.util.Map;
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
    private static final String URL = "/financeiro/formas-pagamento";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JwtService jwt;
    String tokenA, tokenB;

    @BeforeEach
    void preparar() {
        tokenA = "Bearer " + jwt.gerarToken(1L, "02360684663", 1L, PerfilUsuario.USUARIO);
        tokenB = "Bearer " + jwt.gerarToken(2L, "11144477735", 2L, PerfilUsuario.USUARIO);
    }

    @Test
    void catalogoGlobalCompartilhadoSemEmpresaInclusiveAoCriar() throws Exception {
        mvc.perform(get(URL).header(HttpHeaders.AUTHORIZATION, tokenA)).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(6));
        var resultado = mvc.perform(post(URL).header(HttpHeaders.AUTHORIZATION, tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of("descricao", "  PIX Alternativo  ", "tipo", "PIX", "empresaId", 999))))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.descricao").value("PIX Alternativo"))
                .andExpect(jsonPath("$.ativo").value(true)).andExpect(jsonPath("$.empresaId").doesNotExist()).andReturn();
        long id = json.readTree(resultado.getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(get(URL + "/" + id).header(HttpHeaders.AUTHORIZATION, tokenB)).andExpect(status().isOk())
                .andExpect(jsonPath("$.descricao").value("PIX Alternativo"));
        mvc.perform(get(URL).header(HttpHeaders.AUTHORIZATION, tokenB)).andExpect(jsonPath("$.length()").value(7));
    }

    @Test
    void atualizarInativarEReativarSemExcluir() throws Exception {
        for (boolean ativo : new boolean[]{false, true}) {
            mvc.perform(put(URL + "/1").header(HttpHeaders.AUTHORIZATION, tokenA)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json.writeValueAsBytes(Map.of("descricao", "Dinheiro atualizado", "tipo", "DINHEIRO", "ativo", ativo))))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.ativo").value(ativo));
            mvc.perform(get(URL + "/1").header(HttpHeaders.AUTHORIZATION, tokenB))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.ativo").value(ativo));
        }
        mvc.perform(delete(URL + "/1").header(HttpHeaders.AUTHORIZATION, tokenA))
                .andExpect(status().isMethodNotAllowed());
    }

    @ParameterizedTest
    @ValueSource(strings = {"DINHEIRO", "PIX", "DEBITO", "CREDITO", "BOLETO", "TRANSFERENCIA"})
    void criaTodosOsTiposValidos(String tipo) throws Exception {
        mvc.perform(post(URL).header(HttpHeaders.AUTHORIZATION, tokenA).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of("descricao", "Forma " + tipo, "tipo", tipo))))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.tipo").value(tipo));
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"descricao\":\"  \",\"tipo\":\"PIX\"}",
            "{\"descricao\":\"Teste\"}", "{\"descricao\":\"Teste\",\"tipo\":\"INVALIDO\"}"})
    void rejeitaDescricaoOuTipoInvalido(String pedido) throws Exception {
        mvc.perform(post(URL).header(HttpHeaders.AUTHORIZATION, tokenA).contentType(MediaType.APPLICATION_JSON)
                .content(pedido)).andExpect(status().isBadRequest());
    }

    @Test
    void rejeitaDescricaoLongaDuplicidadeETrocaDeTipo() throws Exception {
        mvc.perform(post(URL).header(HttpHeaders.AUTHORIZATION, tokenA).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(Map.of("descricao", "x".repeat(151), "tipo", "PIX"))))
                .andExpect(status().isBadRequest());
        mvc.perform(post(URL).header(HttpHeaders.AUTHORIZATION, tokenA).contentType(MediaType.APPLICATION_JSON)
                .content("{\"descricao\":\" pix \",\"tipo\":\"PIX\"}")).andExpect(status().isConflict());
        mvc.perform(put(URL + "/1").header(HttpHeaders.AUTHORIZATION, tokenA).contentType(MediaType.APPLICATION_JSON)
                .content("{\"descricao\":\"PIX\",\"tipo\":\"DINHEIRO\"}")).andExpect(status().isConflict());
        mvc.perform(put(URL + "/1").header(HttpHeaders.AUTHORIZATION, tokenA).contentType(MediaType.APPLICATION_JSON)
                .content("{\"descricao\":\"Dinheiro\",\"tipo\":\"PIX\"}")).andExpect(status().isConflict());
    }

    @Test
    void inexistenteRetorna404EEndpointsExigemAutenticacao() throws Exception {
        mvc.perform(get(URL + "/999").header(HttpHeaders.AUTHORIZATION, tokenA)).andExpect(status().isNotFound());
        mvc.perform(put(URL + "/999").header(HttpHeaders.AUTHORIZATION, tokenA).contentType(MediaType.APPLICATION_JSON)
                .content("{\"descricao\":\"Teste\",\"tipo\":\"PIX\"}")).andExpect(status().isNotFound());
        mvc.perform(get(URL)).andExpect(status().isUnauthorized());
        mvc.perform(get(URL + "/1")).andExpect(status().isUnauthorized());
        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(put(URL + "/1").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }
}
