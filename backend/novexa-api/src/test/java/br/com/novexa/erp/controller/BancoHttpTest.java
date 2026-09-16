package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.BancoEntity;
import br.com.novexa.erp.entity.PerfilUsuario;
import br.com.novexa.erp.repository.BancoRepository;
import br.com.novexa.erp.service.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:bancos-http;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
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
class BancoHttpTest {

    private static final String URL = "/financeiro/bancos";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private BancoRepository bancos;

    @Autowired
    private JwtService jwt;

    private String tokenEmpresaA;
    private String tokenEmpresaB;

    @BeforeEach
    void preparar() {
        tokenEmpresaA = "Bearer " + jwt.gerarToken(1L, "02360684663", 1L, PerfilUsuario.USUARIO);
        tokenEmpresaB = "Bearer " + jwt.gerarToken(2L, "11144477735", 2L, PerfilUsuario.USUARIO);
    }

    @Test
    void criarBancoGlobalComAtivoPadrao() throws Exception {
        mvc.perform(post(URL)
                        .header(HttpHeaders.AUTHORIZATION, tokenEmpresaA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "numero", " 001 ",
                                "nome", " Banco Global ",
                                "cnab", " 400 ",
                                "empresaId", 999
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.numero").value("001"))
                .andExpect(jsonPath("$.nome").value("Banco Global"))
                .andExpect(jsonPath("$.cnab").value("400"))
                .andExpect(jsonPath("$.ativo").value(true))
                .andExpect(jsonPath("$.empresaId").doesNotExist());

        mvc.perform(get(URL).header(HttpHeaders.AUTHORIZATION, tokenEmpresaB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].numero").value("001"));
    }

    @Test
    void listarBancosOrdenadosPorNomeENumero() throws Exception {
        bancos.save(new BancoEntity("002", "Banco Beta", null, true));
        bancos.save(new BancoEntity("003", "Banco Alfa", null, true));
        bancos.save(new BancoEntity("001", "Banco Alfa", null, true));

        mvc.perform(get(URL).header(HttpHeaders.AUTHORIZATION, tokenEmpresaA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].numero").value("001"))
                .andExpect(jsonPath("$[1].numero").value("003"))
                .andExpect(jsonPath("$[2].numero").value("002"));
    }

    @Test
    void atualizarInativarEReativarBanco() throws Exception {
        BancoEntity banco = bancos.saveAndFlush(new BancoEntity("001", "Banco Inicial", null, true));

        for (boolean ativo : new boolean[]{false, true}) {
            mvc.perform(put(URL + "/" + banco.getId())
                            .header(HttpHeaders.AUTHORIZATION, tokenEmpresaA)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json.writeValueAsBytes(Map.of(
                                    "numero", "001",
                                    "nome", "Banco Atualizado",
                                    "cnab", "240",
                                    "ativo", ativo
                            ))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.nome").value("Banco Atualizado"))
                    .andExpect(jsonPath("$.ativo").value(ativo));
        }
    }

    @Test
    void impedirNumeroDuplicadoNaCriacaoEAtualizacao() throws Exception {
        BancoEntity origem = bancos.saveAndFlush(new BancoEntity("001", "Banco Origem", null, true));
        bancos.saveAndFlush(new BancoEntity("002", "Banco Destino", null, true));

        mvc.perform(post(URL)
                        .header(HttpHeaders.AUTHORIZATION, tokenEmpresaA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"numero\":\"001\",\"nome\":\"Outro Banco\"}"))
                .andExpect(status().isConflict());

        mvc.perform(put(URL + "/" + origem.getId())
                        .header(HttpHeaders.AUTHORIZATION, tokenEmpresaA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"numero\":\"002\",\"nome\":\"Banco Origem\",\"ativo\":true}"))
                .andExpect(status().isConflict());
    }

    @Test
    void idInexistenteRetorna404() throws Exception {
        mvc.perform(put(URL + "/999")
                        .header(HttpHeaders.AUTHORIZATION, tokenEmpresaA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"numero\":\"001\",\"nome\":\"Banco Inexistente\",\"ativo\":true}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void numeroENomeSaoObrigatorios() throws Exception {
        mvc.perform(post(URL)
                        .header(HttpHeaders.AUTHORIZATION, tokenEmpresaA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }
}
