package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.service.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:contas-financeiras;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa", "spring.datasource.password=", "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false",
        "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=60000"
})
@AutoConfigureMockMvc
@Transactional
class ContaFinanceiraHttpTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired ContaFinanceiraRepository contas;
    @Autowired MovimentacaoFinanceiraRepository movimentos;
    @Autowired JwtService jwt;
    EmpresaEntity empresaA, empresaB;
    String tokenA, tokenB;

    @BeforeEach void preparar() {
        empresaA = empresa("A"); empresaB = empresa("B");
        tokenA = "Bearer " + jwt.gerarToken(usuario(empresaA, "02360684663"));
        tokenB = "Bearer " + jwt.gerarToken(usuario(empresaB, "52998224725"));
    }

    @Test void criaContaNoTenantDoJwtEListaSomenteAsSuas() throws Exception {
        long id = criarConta(tokenA, 100);
        mvc.perform(get("/financeiro/contas-financeiras").header("Authorization", tokenA))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(id))
                .andExpect(jsonPath("$[0].saldoAtual").value(100))
                .andExpect(jsonPath("$[0].ativo").value(true));
        mvc.perform(get("/financeiro/contas-financeiras").header("Authorization", tokenB))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        assertThat(contas.findById(id).orElseThrow().getEmpresa().getId()).isEqualTo(empresaA.getId());
    }

    @Test void edicaoNaoAlteraSaldoInicialESituacaoTemAcaoPropria() throws Exception {
        long id = criarConta(tokenA, 100);
        mvc.perform(put("/financeiro/contas-financeiras/" + id).header("Authorization", tokenA)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of(
                                "nome", "Conta renomeada", "tipo", "COFRE", "saldoInicial", 999,
                                "empresaId", empresaB.getId()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.nome").value("Conta renomeada"))
                .andExpect(jsonPath("$.saldoInicial").value(100));
        mvc.perform(patch("/financeiro/contas-financeiras/" + id + "/situacao")
                        .header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ativo\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ativo").value(false));
    }

    @Test void entradaAumentaESaidaDiminuiSaldoComHistorico() throws Exception {
        long id = criarConta(tokenA, 100);
        long entrada = movimentar(tokenA, id, "ENTRADA", 50);
        long saida = movimentar(tokenA, id, "SAIDA", 30);
        assertThat(contas.findById(id).orElseThrow().getSaldoAtual()).isEqualByComparingTo("120.00");
        mvc.perform(get("/financeiro/movimentacoes-financeiras").header("Authorization", tokenA)
                        .param("contaFinanceiraId", String.valueOf(id)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(saida))
                .andExpect(jsonPath("$[1].id").value(entrada))
                .andExpect(jsonPath("$[0].origem").value("MANUAL"))
                .andExpect(jsonPath("$[0].usuarioNome").value("Admin"));
    }

    @Test void saidaSemSaldoFalhaSemPersistirMovimento() throws Exception {
        long id = criarConta(tokenA, 10);
        mvc.perform(post("/financeiro/movimentacoes-financeiras").header("Authorization", tokenA)
                        .contentType(MediaType.APPLICATION_JSON).content(pedidoMovimento(id, "SAIDA", 11)))
                .andExpect(status().isConflict());
        assertThat(contas.findById(id).orElseThrow().getSaldoAtual()).isEqualByComparingTo("10.00");
        assertThat(movimentos.count()).isZero();
    }

    @Test void estornoReverteSaldoPreservaRegistroEBloqueiaRepeticao() throws Exception {
        long id = criarConta(tokenA, 100);
        long movimentoId = movimentar(tokenA, id, "SAIDA", 30);
        mvc.perform(patch("/financeiro/movimentacoes-financeiras/" + movimentoId + "/estorno")
                        .header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"motivoEstorno\":\"Lançamento duplicado\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.estornada").value(true))
                .andExpect(jsonPath("$.motivoEstorno").value("Lançamento duplicado"))
                .andExpect(jsonPath("$.usuarioEstornoNome").value("Admin"));
        mvc.perform(patch("/financeiro/movimentacoes-financeiras/" + movimentoId + "/estorno")
                        .header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"motivoEstorno\":\"Repetir\"}"))
                .andExpect(status().isConflict());
        assertThat(contas.findById(id).orElseThrow().getSaldoAtual()).isEqualByComparingTo("100.00");
        assertThat(movimentos.count()).isEqualTo(1);
        mvc.perform(delete("/financeiro/movimentacoes-financeiras/" + movimentoId)
                        .header("Authorization", tokenA))
                .andExpect(status().isNotFound());
        assertThat(movimentos.count()).isEqualTo(1);
    }

    @Test void contaInativaNaoRecebeMovimentoMasPermiteEstornarHistorico() throws Exception {
        long id = criarConta(tokenA, 100);
        long movimentoId = movimentar(tokenA, id, "SAIDA", 20);
        mvc.perform(patch("/financeiro/contas-financeiras/" + id + "/situacao")
                        .header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ativo\":false}"))
                .andExpect(status().isOk());
        mvc.perform(post("/financeiro/movimentacoes-financeiras").header("Authorization", tokenA)
                        .contentType(MediaType.APPLICATION_JSON).content(pedidoMovimento(id, "ENTRADA", 10)))
                .andExpect(status().isConflict());
        mvc.perform(patch("/financeiro/movimentacoes-financeiras/" + movimentoId + "/estorno")
                        .header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"motivoEstorno\":\"Correção\"}"))
                .andExpect(status().isOk());
        assertThat(contas.findById(id).orElseThrow().getSaldoAtual()).isEqualByComparingTo("100.00");
    }

    @Test void estornoDeEntradaNaoPodeGerarSaldoNegativo() throws Exception {
        long id = criarConta(tokenA, 0);
        long entrada = movimentar(tokenA, id, "ENTRADA", 20);
        movimentar(tokenA, id, "SAIDA", 15);
        mvc.perform(patch("/financeiro/movimentacoes-financeiras/" + entrada + "/estorno")
                        .header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"motivoEstorno\":\"Teste\"}"))
                .andExpect(status().isConflict());
        assertThat(contas.findById(id).orElseThrow().getSaldoAtual()).isEqualByComparingTo("5.00");
        assertThat(movimentos.findById(entrada).orElseThrow().isEstornada()).isFalse();
    }

    @Test void bloqueiaContaEMovimentoDeOutraEmpresa() throws Exception {
        long id = criarConta(tokenA, 100);
        long movimento = movimentar(tokenA, id, "ENTRADA", 10);
        mvc.perform(put("/financeiro/contas-financeiras/" + id).header("Authorization", tokenB)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"nome\":\"Outra\",\"tipo\":\"BANCO\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(patch("/financeiro/contas-financeiras/" + id + "/situacao").header("Authorization", tokenB)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"ativo\":false}"))
                .andExpect(status().isNotFound());
        mvc.perform(post("/financeiro/movimentacoes-financeiras").header("Authorization", tokenB)
                        .contentType(MediaType.APPLICATION_JSON).content(pedidoMovimento(id, "ENTRADA", 10)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/financeiro/movimentacoes-financeiras").header("Authorization", tokenB)
                        .param("contaFinanceiraId", String.valueOf(id)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/financeiro/movimentacoes-financeiras").header("Authorization", tokenB))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(patch("/financeiro/movimentacoes-financeiras/" + movimento + "/estorno")
                        .header("Authorization", tokenB).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"motivoEstorno\":\"Teste\"}"))
                .andExpect(status().isNotFound());
        assertThat(contas.findById(id).orElseThrow().getSaldoAtual()).isEqualByComparingTo("110.00");
    }

    @Test void validaValorEAutenticacao() throws Exception {
        mvc.perform(post("/financeiro/contas-financeiras").header("Authorization", tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Inválida\",\"tipo\":\"BANCO\",\"saldoInicial\":-1}"))
                .andExpect(status().isBadRequest());
        long id = criarConta(tokenA, 0);
        mvc.perform(post("/financeiro/movimentacoes-financeiras").header("Authorization", tokenA)
                        .contentType(MediaType.APPLICATION_JSON).content(pedidoMovimento(id, "ENTRADA", 0)))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/financeiro/movimentacoes-financeiras").header("Authorization", tokenA)
                        .contentType(MediaType.APPLICATION_JSON).content(pedidoMovimento(id, "ENTRADA", 1.234)))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/financeiro/contas-financeiras")).andExpect(status().isUnauthorized());
    }

    private long criarConta(String token, Number saldo) throws Exception {
        var resposta = mvc.perform(post("/financeiro/contas-financeiras").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of(
                                "nome", "Conta principal", "tipo", "BANCO", "saldoInicial", saldo,
                                "empresaId", empresaB.getId()))))
                .andExpect(status().isCreated()).andReturn();
        return json.readTree(resposta.getResponse().getContentAsString()).get("id").asLong();
    }

    private long movimentar(String token, long contaId, String tipo, Number valor) throws Exception {
        var resposta = mvc.perform(post("/financeiro/movimentacoes-financeiras").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content(pedidoMovimento(contaId, tipo, valor)))
                .andExpect(status().isCreated()).andReturn();
        return json.readTree(resposta.getResponse().getContentAsString()).get("id").asLong();
    }

    private String pedidoMovimento(long contaId, String tipo, Number valor) throws Exception {
        return json.writeValueAsString(Map.of("contaFinanceiraId", contaId, "tipo", tipo, "descricao", "Ajuste manual",
                "valor", valor, "dataMovimento", "2026-09-29", "empresaId", empresaB.getId()));
    }

    private EmpresaEntity empresa(String nome) {
        var empresa = new EmpresaEntity(); empresa.setRazaoSocial(nome); empresa.setAtivo(true);
        return empresas.saveAndFlush(empresa);
    }

    private UsuarioEntity usuario(EmpresaEntity empresa, String cpf) {
        var usuario = new UsuarioEntity(); usuario.setEmpresa(empresa); usuario.setCpf(cpf);
        usuario.setNomeUsuario("Admin"); usuario.setSenha("hash"); usuario.setAtivo(true);
        usuario.setPerfil(PerfilUsuario.ADMIN); return usuarios.saveAndFlush(usuario);
    }
}
