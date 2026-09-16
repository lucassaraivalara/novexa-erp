package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.AgenciaEntity;
import br.com.novexa.erp.entity.BancoEntity;
import br.com.novexa.erp.entity.PerfilUsuario;
import br.com.novexa.erp.repository.AgenciaRepository;
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
        "spring.datasource.url=jdbc:h2:mem:agencias-http;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
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
class AgenciaHttpTest {

    private static final String URL = "/financeiro/agencias";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private BancoRepository bancos;

    @Autowired
    private AgenciaRepository agencias;

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
    void criarAgenciaGlobalVinculadaAoBancoComAtivoPadrao() throws Exception {
        BancoEntity banco = banco("001", "Banco Global", true);

        mvc.perform(post(URL)
                        .header(HttpHeaders.AUTHORIZATION, tokenEmpresaA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "bancoId", banco.getId(),
                                "numero", " 1234 ",
                                "digito", " 5 ",
                                "contato", " Contato ",
                                "telefone", " 11999999999 ",
                                "cidade", " Sao Paulo ",
                                "empresaId", 999
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.bancoId").value(banco.getId()))
                .andExpect(jsonPath("$.bancoNumero").value("001"))
                .andExpect(jsonPath("$.bancoNome").value("Banco Global"))
                .andExpect(jsonPath("$.numero").value("1234"))
                .andExpect(jsonPath("$.digito").value("5"))
                .andExpect(jsonPath("$.ativo").value(true))
                .andExpect(jsonPath("$.empresaId").doesNotExist());

        mvc.perform(get(URL).header(HttpHeaders.AUTHORIZATION, tokenEmpresaB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].numero").value("1234"));
    }

    @Test
    void listarAgenciasEmOrdemEstavel() throws Exception {
        BancoEntity bancoBeta = banco("002", "Banco Beta", true);
        BancoEntity bancoAlfa = banco("001", "Banco Alfa", true);
        agencia(bancoBeta, "1000");
        agencia(bancoAlfa, "2000");
        agencia(bancoAlfa, "1000");

        mvc.perform(get(URL).header(HttpHeaders.AUTHORIZATION, tokenEmpresaA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].bancoNome").value("Banco Alfa"))
                .andExpect(jsonPath("$[0].numero").value("1000"))
                .andExpect(jsonPath("$[1].numero").value("2000"))
                .andExpect(jsonPath("$[2].bancoNome").value("Banco Beta"));
    }

    @Test
    void filtrarAgenciasPorBancoId() throws Exception {
        BancoEntity bancoA = banco("001", "Banco A", true);
        BancoEntity bancoB = banco("002", "Banco B", true);
        agencia(bancoA, "1000");
        agencia(bancoB, "2000");

        mvc.perform(get(URL)
                        .param("bancoId", bancoB.getId().toString())
                        .header(HttpHeaders.AUTHORIZATION, tokenEmpresaA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].bancoId").value(bancoB.getId()))
                .andExpect(jsonPath("$[0].numero").value("2000"));
    }

    @Test
    void atualizarInativarEReativarPreservandoBanco() throws Exception {
        BancoEntity banco = banco("001", "Banco Inicial", true);
        AgenciaEntity agencia = agencia(banco, "1000");
        banco.atualizar("001", "Banco Inicial", null, false);
        bancos.saveAndFlush(banco);

        for (boolean ativo : new boolean[]{false, true}) {
            mvc.perform(put(URL + "/" + agencia.getId())
                            .header(HttpHeaders.AUTHORIZATION, tokenEmpresaA)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json.writeValueAsBytes(Map.of(
                                    "bancoId", banco.getId(),
                                    "numero", "1001",
                                    "digito", "9",
                                    "contato", "Contato atualizado",
                                    "telefone", "1133334444",
                                    "cidade", "Campinas",
                                    "ativo", ativo
                            ))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.bancoId").value(banco.getId()))
                    .andExpect(jsonPath("$.numero").value("1001"))
                    .andExpect(jsonPath("$.ativo").value(ativo));
        }
    }

    @Test
    void bancoInexistenteRetorna404NaCriacaoENaAtualizacao() throws Exception {
        BancoEntity banco = banco("001", "Banco Existente", true);
        AgenciaEntity agencia = agencia(banco, "1000");
        String pedido = "{\"bancoId\":999,\"numero\":\"1001\",\"ativo\":true}";

        mvc.perform(post(URL)
                        .header(HttpHeaders.AUTHORIZATION, tokenEmpresaA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(pedido))
                .andExpect(status().isNotFound());

        mvc.perform(put(URL + "/" + agencia.getId())
                        .header(HttpHeaders.AUTHORIZATION, tokenEmpresaA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(pedido))
                .andExpect(status().isNotFound());
    }

    @Test
    void impedirNovaAgenciaVinculadaABancoInativo() throws Exception {
        BancoEntity banco = banco("001", "Banco Inativo", false);

        mvc.perform(post(URL)
                        .header(HttpHeaders.AUTHORIZATION, tokenEmpresaA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "bancoId", banco.getId(),
                                "numero", "1000"
                        ))))
                .andExpect(status().isConflict());
    }

    @Test
    void impedirNumeroDuplicadoNoMesmoBancoEPermitirEmOutro() throws Exception {
        BancoEntity bancoA = banco("001", "Banco A", true);
        BancoEntity bancoB = banco("002", "Banco B", true);
        AgenciaEntity origem = agencia(bancoA, "1000");
        agencia(bancoA, "2000");

        mvc.perform(post(URL)
                        .header(HttpHeaders.AUTHORIZATION, tokenEmpresaA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "bancoId", bancoA.getId(),
                                "numero", "1000"
                        ))))
                .andExpect(status().isConflict());

        mvc.perform(put(URL + "/" + origem.getId())
                        .header(HttpHeaders.AUTHORIZATION, tokenEmpresaA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "bancoId", bancoA.getId(),
                                "numero", "2000",
                                "ativo", true
                        ))))
                .andExpect(status().isConflict());

        mvc.perform(post(URL)
                        .header(HttpHeaders.AUTHORIZATION, tokenEmpresaA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "bancoId", bancoB.getId(),
                                "numero", "1000"
                        ))))
                .andExpect(status().isCreated());
    }

    @Test
    void idDeAgenciaInexistenteRetorna404() throws Exception {
        BancoEntity banco = banco("001", "Banco Existente", true);

        mvc.perform(put(URL + "/999")
                        .header(HttpHeaders.AUTHORIZATION, tokenEmpresaA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "bancoId", banco.getId(),
                                "numero", "1000",
                                "ativo", true
                        ))))
                .andExpect(status().isNotFound());
    }

    @Test
    void bancoENumeroSaoObrigatorios() throws Exception {
        mvc.perform(post(URL)
                        .header(HttpHeaders.AUTHORIZATION, tokenEmpresaA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    private BancoEntity banco(String numero, String nome, boolean ativo) {
        return bancos.saveAndFlush(new BancoEntity(numero, nome, null, ativo));
    }

    private AgenciaEntity agencia(BancoEntity banco, String numero) {
        return agencias.saveAndFlush(new AgenciaEntity(
                banco,
                numero,
                null,
                null,
                null,
                null,
                true
        ));
    }
}
