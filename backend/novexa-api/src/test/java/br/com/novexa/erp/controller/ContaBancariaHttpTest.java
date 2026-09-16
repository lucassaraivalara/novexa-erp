package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.AgenciaEntity;
import br.com.novexa.erp.entity.BancoEntity;
import br.com.novexa.erp.entity.ContaBancariaEntity;
import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.entity.PerfilUsuario;
import br.com.novexa.erp.entity.TipoContaBancaria;
import br.com.novexa.erp.repository.AgenciaRepository;
import br.com.novexa.erp.repository.BancoRepository;
import br.com.novexa.erp.repository.ContaBancariaRepository;
import br.com.novexa.erp.repository.EmpresaRepository;
import br.com.novexa.erp.service.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:contas-bancarias-http;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
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
class ContaBancariaHttpTest {

    private static final String URL = "/financeiro/contas-bancarias";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private EmpresaRepository empresas;

    @Autowired
    private BancoRepository bancos;

    @Autowired
    private AgenciaRepository agencias;

    @Autowired
    private ContaBancariaRepository contas;

    @Autowired
    private JwtService jwt;

    @Autowired
    private EntityManager entityManager;

    private EmpresaEntity empresaA;
    private EmpresaEntity empresaB;
    private BancoEntity bancoA;
    private BancoEntity bancoB;
    private AgenciaEntity agenciaA;
    private AgenciaEntity agenciaB;
    private String tokenA;
    private String tokenB;

    @BeforeEach
    void preparar() {
        empresaA = empresa("Empresa A", "11222333000181");
        empresaB = empresa("Empresa B", "12345678000190");
        bancoA = banco("001", "Banco A");
        bancoB = banco("002", "Banco B");
        agenciaA = agencia(bancoA, "1000", "1", true);
        agenciaB = agencia(bancoB, "2000", "2", true);
        tokenA = token(1L, "02360684663", empresaA.getId());
        tokenB = token(2L, "11144477735", empresaB.getId());
    }

    @Test
    void criarContaParaEmpresaAutenticada() throws Exception {
        var resultado = mvc.perform(post(URL)
                        .header(HttpHeaders.AUTHORIZATION, tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "empresaId", empresaB.getId(),
                                "agenciaId", agenciaA.getId(),
                                "numero", " 12345 ",
                                "digito", " ",
                                "tipo", "CORRENTE"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.bancoId").value(bancoA.getId()))
                .andExpect(jsonPath("$.bancoNumero").value("001"))
                .andExpect(jsonPath("$.bancoNome").value("Banco A"))
                .andExpect(jsonPath("$.agenciaId").value(agenciaA.getId()))
                .andExpect(jsonPath("$.agenciaNumero").value("1000"))
                .andExpect(jsonPath("$.agenciaDigito").value("1"))
                .andExpect(jsonPath("$.numero").value("12345"))
                .andExpect(jsonPath("$.digito").isEmpty())
                .andExpect(jsonPath("$.titular").isEmpty())
                .andExpect(jsonPath("$.tipo").value("CORRENTE"))
                .andExpect(jsonPath("$.ativo").value(true))
                .andExpect(jsonPath("$.empresaId").doesNotExist())
                .andReturn();

        long id = json.readTree(resultado.getResponse().getContentAsString()).get("id").asLong();
        entityManager.flush();
        entityManager.clear();
        assertThat(contas.findById(id).orElseThrow().getEmpresa().getId()).isEqualTo(empresaA.getId());
    }

    @Test
    void listarSomenteContasDaEmpresaAutenticada() throws Exception {
        ContaBancariaEntity contaA = conta(empresaA, agenciaA, "100", null, TipoContaBancaria.CORRENTE, true);
        conta(empresaB, agenciaA, "200", null, TipoContaBancaria.CORRENTE, true);

        mvc.perform(get(URL).header(HttpHeaders.AUTHORIZATION, tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(contaA.getId()));
    }

    @Test
    void filtrarPorAgenciaId() throws Exception {
        conta(empresaA, agenciaA, "100", null, TipoContaBancaria.CORRENTE, true);
        conta(empresaA, agenciaB, "200", null, TipoContaBancaria.CORRENTE, true);

        mvc.perform(get(URL)
                        .param("agenciaId", agenciaB.getId().toString())
                        .header(HttpHeaders.AUTHORIZATION, tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].agenciaId").value(agenciaB.getId()));
    }

    @Test
    void filtrarPorBancoId() throws Exception {
        conta(empresaA, agenciaA, "100", null, TipoContaBancaria.CORRENTE, true);
        conta(empresaA, agenciaB, "200", null, TipoContaBancaria.CORRENTE, true);

        mvc.perform(get(URL)
                        .param("bancoId", bancoB.getId().toString())
                        .header(HttpHeaders.AUTHORIZATION, tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].bancoId").value(bancoB.getId()));
    }

    @Test
    void filtrarPorTipoEAtivo() throws Exception {
        conta(empresaA, agenciaA, "100", null, TipoContaBancaria.CORRENTE, true);
        conta(empresaA, agenciaA, "200", null, TipoContaBancaria.POUPANCA, false);
        conta(empresaB, agenciaA, "300", null, TipoContaBancaria.POUPANCA, false);

        mvc.perform(get(URL)
                        .param("tipo", "POUPANCA")
                        .param("ativo", "false")
                        .header(HttpHeaders.AUTHORIZATION, tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].tipo").value("POUPANCA"))
                .andExpect(jsonPath("$[0].ativo").value(false));
    }

    @Test
    void atualizarInativarEReativarPreservandoAgencia() throws Exception {
        ContaBancariaEntity conta = conta(
                empresaA,
                agenciaA,
                "100",
                null,
                TipoContaBancaria.CORRENTE,
                true
        );
        agenciaA.atualizar(bancoA, "1000", "1", null, null, null, false);
        agencias.saveAndFlush(agenciaA);

        for (boolean ativo : new boolean[]{false, true}) {
            mvc.perform(put(URL + "/" + conta.getId())
                            .header(HttpHeaders.AUTHORIZATION, tokenA)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json.writeValueAsBytes(Map.of(
                                    "agenciaId", agenciaA.getId(),
                                    "numero", "101",
                                    "digito", "9",
                                    "titular", "Titular Atualizado",
                                    "tipo", "POUPANCA",
                                    "ativo", ativo
                            ))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.agenciaId").value(agenciaA.getId()))
                    .andExpect(jsonPath("$.numero").value("101"))
                    .andExpect(jsonPath("$.tipo").value("POUPANCA"))
                    .andExpect(jsonPath("$.ativo").value(ativo));
        }
    }

    @Test
    void agenciaInexistenteRetorna404NaCriacaoENaAtualizacao() throws Exception {
        ContaBancariaEntity conta = conta(
                empresaA,
                agenciaA,
                "100",
                null,
                TipoContaBancaria.CORRENTE,
                true
        );
        String pedido = "{\"agenciaId\":999,\"numero\":\"101\",\"tipo\":\"CORRENTE\"}";

        mvc.perform(post(URL)
                        .header(HttpHeaders.AUTHORIZATION, tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(pedido))
                .andExpect(status().isNotFound());

        mvc.perform(put(URL + "/" + conta.getId())
                        .header(HttpHeaders.AUTHORIZATION, tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(pedido))
                .andExpect(status().isNotFound());
    }

    @Test
    void impedirNovaContaETransferenciaParaAgenciaInativa() throws Exception {
        AgenciaEntity inativa = agencia(bancoA, "3000", null, false);
        ContaBancariaEntity conta = conta(
                empresaA,
                agenciaA,
                "100",
                null,
                TipoContaBancaria.CORRENTE,
                true
        );
        byte[] pedido = json.writeValueAsBytes(Map.of(
                "agenciaId", inativa.getId(),
                "numero", "101",
                "tipo", "CORRENTE"
        ));

        mvc.perform(post(URL)
                        .header(HttpHeaders.AUTHORIZATION, tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(pedido))
                .andExpect(status().isConflict());

        mvc.perform(put(URL + "/" + conta.getId())
                        .header(HttpHeaders.AUTHORIZATION, tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(pedido))
                .andExpect(status().isConflict());
    }

    @Test
    void impedirDuplicidadeNaMesmaEmpresaEAgenciaInclusiveSemDigito() throws Exception {
        ContaBancariaEntity origem = conta(
                empresaA,
                agenciaA,
                "100",
                null,
                TipoContaBancaria.CORRENTE,
                true
        );
        conta(empresaA, agenciaA, "200", null, TipoContaBancaria.CORRENTE, true);

        mvc.perform(post(URL)
                        .header(HttpHeaders.AUTHORIZATION, tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "agenciaId", agenciaA.getId(),
                                "numero", "100",
                                "tipo", "CORRENTE"
                        ))))
                .andExpect(status().isConflict());

        mvc.perform(put(URL + "/" + origem.getId())
                        .header(HttpHeaders.AUTHORIZATION, tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "agenciaId", agenciaA.getId(),
                                "numero", "200",
                                "tipo", "CORRENTE"
                        ))))
                .andExpect(status().isConflict());

        mvc.perform(post(URL)
                        .header(HttpHeaders.AUTHORIZATION, tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "agenciaId", agenciaA.getId(),
                                "numero", "100",
                                "digito", "1",
                                "tipo", "CORRENTE"
                        ))))
                .andExpect(status().isCreated());
    }

    @Test
    void permitirMesmaNumeracaoEmEmpresasDiferentes() throws Exception {
        conta(empresaA, agenciaA, "100", null, TipoContaBancaria.CORRENTE, true);

        mvc.perform(post(URL)
                        .header(HttpHeaders.AUTHORIZATION, tokenB)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "agenciaId", agenciaA.getId(),
                                "numero", "100",
                                "tipo", "CORRENTE"
                        ))))
                .andExpect(status().isCreated());
    }

    @Test
    void impedirAtualizacaoCrossTenant() throws Exception {
        ContaBancariaEntity contaB = conta(
                empresaB,
                agenciaA,
                "100",
                null,
                TipoContaBancaria.CORRENTE,
                true
        );

        mvc.perform(put(URL + "/" + contaB.getId())
                        .header(HttpHeaders.AUTHORIZATION, tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "agenciaId", agenciaB.getId(),
                                "numero", "999",
                                "tipo", "POUPANCA",
                                "ativo", false
                        ))))
                .andExpect(status().isNotFound());

        entityManager.flush();
        entityManager.clear();
        ContaBancariaEntity persistida = contas.findById(contaB.getId()).orElseThrow();
        assertThat(persistida.getNumero()).isEqualTo("100");
        assertThat(persistida.isAtivo()).isTrue();
    }

    @Test
    void idInexistenteRetorna404() throws Exception {
        mvc.perform(put(URL + "/999")
                        .header(HttpHeaders.AUTHORIZATION, tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of(
                                "agenciaId", agenciaA.getId(),
                                "numero", "100",
                                "tipo", "CORRENTE"
                        ))))
                .andExpect(status().isNotFound());
    }

    @Test
    void agenciaNumeroETipoSaoObrigatorios() throws Exception {
        mvc.perform(post(URL)
                        .header(HttpHeaders.AUTHORIZATION, tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    private EmpresaEntity empresa(String razaoSocial, String cnpj) {
        EmpresaEntity empresa = new EmpresaEntity();
        empresa.setRazaoSocial(razaoSocial);
        empresa.setCnpj(cnpj);
        empresa.setAtivo(true);
        return empresas.saveAndFlush(empresa);
    }

    private BancoEntity banco(String numero, String nome) {
        return bancos.saveAndFlush(new BancoEntity(numero, nome, null, true));
    }

    private AgenciaEntity agencia(
            BancoEntity banco,
            String numero,
            String digito,
            boolean ativo) {
        return agencias.saveAndFlush(new AgenciaEntity(
                banco,
                numero,
                digito,
                null,
                null,
                null,
                ativo
        ));
    }

    private ContaBancariaEntity conta(
            EmpresaEntity empresa,
            AgenciaEntity agencia,
            String numero,
            String digito,
            TipoContaBancaria tipo,
            boolean ativo) {
        return contas.saveAndFlush(new ContaBancariaEntity(
                empresa,
                agencia,
                numero,
                digito,
                "Titular",
                tipo,
                ativo
        ));
    }

    private String token(Long usuarioId, String cpf, Long empresaId) {
        return "Bearer " + jwt.gerarToken(usuarioId, cpf, empresaId, PerfilUsuario.USUARIO);
    }
}
