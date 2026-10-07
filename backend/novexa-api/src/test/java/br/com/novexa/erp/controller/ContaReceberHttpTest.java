package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.service.JwtService;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:contasreceber;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false",
        "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=60000"})
@AutoConfigureMockMvc
class ContaReceberHttpTest {
    static final String BASE = "/financeiro/contas-receber";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired ClienteRepository clientes;
    @Autowired ContaFinanceiraRepository financeiras;
    @Autowired ContaReceberRepository contas;
    @MockitoSpyBean MovimentacaoFinanceiraRepository movimentos;
    @Autowired JwtService jwt;
    @Autowired JdbcTemplate jdbc;
    EmpresaEntity empresaA, empresaB;
    ClienteEntity clienteA, clienteB;
    ContaFinanceiraEntity bancoA, bancoB;
    UsuarioEntity usuarioA;
    String tokenA, tokenB;

    @BeforeEach void preparar() {
        movimentos.deleteAll(); contas.deleteAll(); financeiras.deleteAll(); clientes.deleteAll(); usuarios.deleteAll(); empresas.deleteAll();
        empresaA = empresa("Empresa A"); empresaB = empresa("Empresa B");
        usuarioA = usuario(empresaA, "02360684663", PerfilUsuario.ADMIN);
        tokenA = "Bearer " + jwt.gerarToken(usuarioA);
        tokenB = "Bearer " + jwt.gerarToken(usuario(empresaB, "52998224725", PerfilUsuario.ADMIN));
        clienteA = cliente(empresaA); clienteB = cliente(empresaB);
        bancoA = financeira(empresaA); bancoB = financeira(empresaB);
    }
    @Test void criaManualSemMovimentarDinheiro() throws Exception {
        var c = criar();
        assertThat(c.get("status").asText()).isEqualTo("PENDENTE");
        assertThat(c.get("origem").asText()).isEqualTo("MANUAL");
        assertThat(c.get("vendaId").isNull()).isTrue();
        assertThat(c.get("numeroParcela").asInt()).isEqualTo(1);
        assertThat(c.get("totalParcelas").asInt()).isEqualTo(1);
        assertThat(c.get("saldo").decimalValue()).isEqualByComparingTo("100");
        assertThat(c.get("recebimentos").size()).isZero();
        assertThat(movimentos.count()).isZero(); saldo(bancoA, "0");
        assertThat(contas.findById(c.get("id").asLong()).orElseThrow().getEmpresa().getId()).isEqualTo(empresaA.getId());
    }
    @ParameterizedTest @ValueSource(strings = {"0", "-1", "1.001"})
    void valorInvalidoRejeita(String valor) throws Exception {
        var p = pedido(); p.put("valorOriginal", new BigDecimal(valor)); criarInvalida(p, 400);
    }
    @Test void exigeCliente() throws Exception { var p = pedido(); p.remove("clienteId"); criarInvalida(p, 400); }
    @Test void rejeitaClienteOutroTenant() throws Exception { var p = pedido(); p.put("clienteId", clienteB.getId()); criarInvalida(p, 404); }
    @Test void rejeitaClienteInativoParaCriacao() throws Exception { clienteA.setAtivo(false); clientes.saveAndFlush(clienteA); criarInvalida(pedido(), 409); }
    @ParameterizedTest @CsvSource({"0,1", "2,1", "1,0"})
    void rejeitaParcelaInvalida(int numero, int total) throws Exception {
        var p = pedido(); p.put("numeroParcela", numero); p.put("totalParcelas", total); criarInvalida(p, 400);
    }
    @Test void editaPendenteAntesDeBaixa() throws Exception {
        var c = criar(); var p = pedido(); p.put("valorOriginal", new BigDecimal("200")); p.put("numeroParcela", 2); p.put("totalParcelas", 3);
        mvc.perform(put(BASE + "/" + c.get("id").asLong()).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(p)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.valorOriginal").value(200)).andExpect(jsonPath("$.numeroParcela").value(2));
    }
    @Test void baixaTotal() throws Exception {
        var c = receber(criar().get("id").asLong(), "100");
        assertThat(c.get("status").asText()).isEqualTo("RECEBIDA"); assertThat(c.get("saldo").decimalValue()).isZero(); saldo(bancoA, "100");
    }
    @Test void duasBaixasParciaisEmDestinosDiferentesPreservamHistorico() throws Exception {
        long id = criar().get("id").asLong(); var outro = financeira(empresaA);
        var parcial = receber(id, "40"); assertThat(parcial.get("status").asText()).isEqualTo("PARCIAL");
        var completa = receber(id, baixa(outro.getId(), "60", UUID.randomUUID()), tokenA, 200);
        assertThat(completa.get("recebimentos").size()).isEqualTo(2);
        assertThat(completa.get("status").asText()).isEqualTo("RECEBIDA"); saldo(bancoA, "40"); saldo(outro, "60");
        for (var m : completa.get("recebimentos")) {
            assertThat(m.get("contaReceberId").asLong()).isEqualTo(id);
            assertThat(m.get("origem").asText()).isEqualTo("CONTA_RECEBER"); assertThat(m.get("tipo").asText()).isEqualTo("ENTRADA");
        }
        mvc.perform(get(BASE + "/" + id).header("Authorization", tokenA)).andExpect(jsonPath("$.recebimentos.length()").value(2));
    }
    @Test void tresBaixasChegamAoTotal() throws Exception {
        long id = criar().get("id").asLong(); receber(id, "20"); receber(id, "30");
        assertThat(receber(id, "50").get("status").asText()).isEqualTo("RECEBIDA"); saldo(bancoA, "100"); assertThat(movimentos.count()).isEqualTo(3);
    }
    @Test void rejeitaBaixaAcimaDoSaldoSemEfeito() throws Exception {
        long id = criar().get("id").asLong(); receber(id, "40"); receber(id, baixa(bancoA.getId(), "61", UUID.randomUUID()), tokenA, 409);
        saldo(bancoA, "40"); assertThat(movimentos.count()).isEqualTo(1);
    }
    @ParameterizedTest @ValueSource(strings = {"0", "-1", "1.001"})
    void rejeitaValorDaBaixaInvalido(String valor) throws Exception {
        receber(criar().get("id").asLong(), baixa(bancoA.getId(), valor, UUID.randomUUID()), tokenA, 400); assertThat(movimentos.count()).isZero();
    }
    @Test void rejeitaContaFinanceiraInativa() throws Exception {
        bancoA.situacao(false); financeiras.saveAndFlush(bancoA);
        receber(criar().get("id").asLong(), baixa(bancoA.getId(), "40", UUID.randomUUID()), tokenA, 409); saldo(bancoA, "0");
    }
    @Test void rejeitaDestinoOutroTenant() throws Exception {
        receber(criar().get("id").asLong(), baixa(bancoB.getId(), "40", UUID.randomUUID()), tokenA, 404); saldo(bancoB, "0");
    }
    @Test void historicoContinuaOperandoComClienteInativo() throws Exception {
        long id = criar().get("id").asLong(); clienteA.setAtivo(false); clientes.saveAndFlush(clienteA);
        var c = receber(id, "40"); assertThat(c.get("cliente").get("ativo").asBoolean()).isFalse();
    }
    @Test void edicaoBloqueadaAposBaixaMesmoQuandoEstornada() throws Exception {
        long id = criar().get("id").asLong(); var c = receber(id, "40");
        editarInvalida(id, 409); estornar(id, c.get("recebimentos").get(0).get("id").asLong(), tokenA, 200); editarInvalida(id, 409);
    }
    @Test void cancelaSemBaixaERepeticaoSegura() throws Exception {
        long id = criar().get("id").asLong();
        for (int i = 0; i < 2; i++) mvc.perform(post(BASE + "/" + id + "/cancelar").header("Authorization", tokenA))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELADA"));
        receber(id, baixa(bancoA.getId(), "40", UUID.randomUUID()), tokenA, 409); editarInvalida(id, 409);
    }
    @Test void cancelamentoExigeEstornoDasBaixasAtivas() throws Exception {
        long id = criar().get("id").asLong(); var c = receber(id, "40");
        mvc.perform(post(BASE + "/" + id + "/cancelar").header("Authorization", tokenA)).andExpect(status().isConflict());
        estornar(id, c.get("recebimentos").get(0).get("id").asLong(), tokenA, 200);
        mvc.perform(post(BASE + "/" + id + "/cancelar").header("Authorization", tokenA)).andExpect(status().isOk());
    }
    @Test void estornoIndividualVoltaParcialDepoisPendente() throws Exception {
        long id = criar().get("id").asLong(); var primeiro = receber(id, "40"); var completa = receber(id, "60");
        long m1 = primeiro.get("recebimentos").get(0).get("id").asLong(), m2 = completa.get("recebimentos").get(1).get("id").asLong();
        var parcial = estornar(id, m2, tokenA, 200); assertThat(parcial.get("status").asText()).isEqualTo("PARCIAL"); saldo(bancoA, "40");
        bancoA = financeiras.findById(bancoA.getId()).orElseThrow(); bancoA.situacao(false); financeiras.saveAndFlush(bancoA);
        var pendente = estornar(id, m1, tokenA, 200); assertThat(pendente.get("status").asText()).isEqualTo("PENDENTE"); saldo(bancoA, "0");
        assertThat(movimentos.count()).isEqualTo(2);
        for (var m : pendente.get("recebimentos")) {
            assertThat(m.get("estornada").asBoolean()).isTrue(); assertThat(m.get("motivoEstorno").asText()).isEqualTo("Correcao");
            assertThat(m.get("usuarioEstornoId").asLong()).isEqualTo(usuarioA.getId());
        }
    }
    @Test void estornoDuplicadoRejeitaSemDebitoDuplo() throws Exception {
        long id = criar().get("id").asLong(); long m = receber(id, "40").get("recebimentos").get(0).get("id").asLong();
        estornar(id, m, tokenA, 200); estornar(id, m, tokenA, 409); saldo(bancoA, "0");
    }
    @Test void estornoDeOutraContaOuTenantRejeita() throws Exception {
        long id = criar().get("id").asLong(), outro = criar().get("id").asLong(); long m = receber(id, "40").get("recebimentos").get(0).get("id").asLong();
        estornar(outro, m, tokenA, 404); estornar(id, m, tokenB, 404); saldo(bancoA, "40");
    }
    @Test void endpointGenericoNaoPodeEstornarRecebimento() throws Exception {
        long m = receber(criar().get("id").asLong(), "40").get("recebimentos").get(0).get("id").asLong();
        mvc.perform(patch("/financeiro/movimentacoes-financeiras/" + m + "/estorno").header("Authorization", tokenA)
                .contentType(MediaType.APPLICATION_JSON).content("{\"motivoEstorno\":\"Correcao\"}")).andExpect(status().isConflict()); saldo(bancoA, "40");
    }
    @Test void rollbackDeEstornoQuandoSaldoInsuficiente() throws Exception {
        long id = criar().get("id").asLong(), m = receber(id, "40").get("recebimentos").get(0).get("id").asLong();
        mvc.perform(post("/financeiro/movimentacoes-financeiras").header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("contaFinanceiraId", bancoA.getId(), "tipo", "SAIDA", "descricao", "Uso do saldo",
                        "valor", 40, "dataMovimento", LocalDate.now().toString())))).andExpect(status().isCreated());
        estornar(id, m, tokenA, 409); assertThat(contas.findById(id).orElseThrow().getValorRecebido()).isEqualByComparingTo("40");
        assertThat(movimentos.findById(m).orElseThrow().isEstornada()).isFalse(); saldo(bancoA, "0");
    }
    @Test void rollbackIntegralQuandoGravacaoDoMovimentoFalha() throws Exception {
        long id = criar().get("id").asLong();
        doThrow(new IllegalStateException("falha controlada")).when(movimentos).saveAndFlush(any(MovimentacaoFinanceiraEntity.class));
        try { receber(id, baixa(bancoA.getId(), "40", UUID.randomUUID()), tokenA, 500); }
        finally { reset(movimentos); }
        saldo(bancoA, "0"); assertThat(contas.findById(id).orElseThrow().getValorRecebido()).isZero(); assertThat(movimentos.count()).isZero();
    }
    @Test void retryMesmaChaveNaoDuplicaMesmoAposEstorno() throws Exception {
        long id = criar().get("id").asLong(); var p = baixa(bancoA.getId(), "40", UUID.randomUUID());
        var primeira = receber(id, p, tokenA, 200); receber(id, p, tokenA, 200); saldo(bancoA, "40"); assertThat(movimentos.count()).isEqualTo(1);
        estornar(id, primeira.get("recebimentos").get(0).get("id").asLong(), tokenA, 200);
        receber(id, p, tokenA, 200); saldo(bancoA, "0"); assertThat(movimentos.count()).isEqualTo(1);
    }
    @Test void chaveReutilizadaComDadosOuContaDiferentesRejeita() throws Exception {
        long id = criar().get("id").asLong(); UUID chave = UUID.randomUUID(); receber(id, baixa(bancoA.getId(), "40", chave), tokenA, 200);
        receber(id, baixa(bancoA.getId(), "41", chave), tokenA, 409);
        receber(criar().get("id").asLong(), baixa(bancoA.getId(), "40", chave), tokenA, 409); saldo(bancoA, "40");
    }
    @Test void getEdicaoCancelamentoEBaixaRespeitamTenant() throws Exception {
        long id = criar().get("id").asLong();
        mvc.perform(get(BASE + "/" + id).header("Authorization", tokenB)).andExpect(status().isNotFound());
        mvc.perform(put(BASE + "/" + id).header("Authorization", tokenB).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(pedido()))).andExpect(status().isNotFound());
        mvc.perform(post(BASE + "/" + id + "/cancelar").header("Authorization", tokenB)).andExpect(status().isNotFound());
        receber(id, baixa(bancoB.getId(), "40", UUID.randomUUID()), tokenB, 404);
    }
    @Test void paginacaoFiltrosSortETenantServerSide() throws Exception {
        long id = criar().get("id").asLong(); criar();
        mvc.perform(get(BASE + "/pagina?page=1&size=1&sort=id,desc").header("Authorization", tokenA))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(2)).andExpect(jsonPath("$.items[0].id").value(id));
        for (String filtro : List.of("termo=Mensalidade", "termo=Cliente", "termo=023.606.846-63", "clienteId=" + clienteA.getId(),
                "origem=MANUAL", "status=PENDENTE", "vencimentoDe=" + LocalDate.now() + "&vencimentoAte=" + LocalDate.now()))
            mvc.perform(get(BASE + "/pagina?" + filtro).header("Authorization", tokenA)).andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(2));
        for (String filtro : List.of("termo=inexistente", "clienteId=" + clienteB.getId(), "status=RECEBIDA", "origem=VENDA_A_PRAZO", "vencimentoAte=" + LocalDate.now().minusDays(1)))
            mvc.perform(get(BASE + "/pagina?" + filtro).header("Authorization", tokenA)).andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(0));
        mvc.perform(get(BASE + "/pagina").header("Authorization", tokenB)).andExpect(jsonPath("$.totalItems").value(0));
        mvc.perform(get(BASE + "/pagina?sort=cliente.senha,asc").header("Authorization", tokenA)).andExpect(status().isBadRequest());
        mvc.perform(get(BASE + "/pagina?vencimentoDe=2026-10-10&vencimentoAte=2026-10-01").header("Authorization", tokenA)).andExpect(status().isBadRequest());
    }
    @Test void resumoUsaSaldoERecebimentosEfetivosNaoAcumulado() throws Exception {
        var p = pedido(); p.put("dataVencimento", LocalDate.now().minusDays(1).toString());
        long vencida = criar(p).get("id").asLong(); var baixa = receber(vencida, "40");
        criar(); p.put("dataVencimento", LocalDate.now().plusDays(20).toString()); criar(p);
        long antiga = criar().get("id").asLong(); var recebimento = baixa(bancoA.getId(), "100", UUID.randomUUID());
        recebimento.put("dataRecebimento", LocalDate.now().minusMonths(1).withDayOfMonth(1).toString()); receber(antiga, recebimento, tokenA, 200);
        mvc.perform(get(BASE + "/resumo").header("Authorization", tokenA)).andExpect(jsonPath("$.vencidas.total").value(60))
                .andExpect(jsonPath("$.seteDias.total").value(100)).andExpect(jsonPath("$.trintaDias.total").value(200))
                .andExpect(jsonPath("$.emAberto.total").value(260)).andExpect(jsonPath("$.recebidasMes.total").value(40));
        estornar(vencida, baixa.get("recebimentos").get(0).get("id").asLong(), tokenA, 200);
        mvc.perform(get(BASE + "/resumo").header("Authorization", tokenA)).andExpect(jsonPath("$.recebidasMes.total").value(0)).andExpect(jsonPath("$.emAberto.total").value(300));
        mvc.perform(get(BASE + "/resumo").header("Authorization", tokenB)).andExpect(jsonPath("$.emAberto.total").value(0));
    }
    @Test void exigeAutenticacao() throws Exception {
        mvc.perform(get(BASE + "/pagina")).andExpect(status().isUnauthorized());
        mvc.perform(post(BASE).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(pedido()))).andExpect(status().isUnauthorized());
    }
    @ParameterizedTest @EnumSource(PerfilUsuario.class)
    void seguePoliticaAutenticadaDeContasPagar(PerfilUsuario perfil) throws Exception {
        usuarioA.setPerfil(perfil); usuarios.saveAndFlush(usuarioA); tokenA = "Bearer " + jwt.gerarToken(usuarioA);
        receber(criar().get("id").asLong(), "40");
    }

    Map<String, Object> pedido() {
        var p = new HashMap<String, Object>(); p.put("clienteId", clienteA.getId()); p.put("descricao", "Mensalidade");
        p.put("valorOriginal", new BigDecimal("100.00")); p.put("dataVencimento", LocalDate.now().toString());
        p.put("empresaId", empresaB.getId()); p.put("vendaId", 999); p.put("origem", "VENDA_A_PRAZO"); return p;
    }
    JsonNode criar() throws Exception { return criar(pedido()); }
    JsonNode criar(Map<String, Object> p) throws Exception {
        return resposta(mvc.perform(post(BASE).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(p))).andExpect(status().isCreated()));
    }
    void criarInvalida(Map<String, Object> p, int status) throws Exception {
        mvc.perform(post(BASE).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(p))).andExpect(status().is(status));
    }
    Map<String, Object> baixa(long financeiraId, String valor, UUID chave) {
        var p = new HashMap<String, Object>(); p.put("contaFinanceiraId", financeiraId); p.put("valor", new BigDecimal(valor));
        p.put("dataRecebimento", LocalDate.now().toString()); p.put("chaveRequisicao", chave.toString()); return p;
    }
    JsonNode receber(long id, String valor) throws Exception { return receber(id, baixa(bancoA.getId(), valor, UUID.randomUUID()), tokenA, 200); }
    JsonNode receber(long id, Map<String, Object> p, String token, int esperado) throws Exception {
        var result = mvc.perform(post(BASE + "/" + id + "/receber").header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(p))).andExpect(status().is(esperado));
        return esperado == 200 ? resposta(result) : null;
    }
    JsonNode estornar(long id, long movimentoId, String token, int esperado) throws Exception {
        var result = mvc.perform(post(BASE + "/" + id + "/recebimentos/" + movimentoId + "/estornar").header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"motivoEstorno\":\"Correcao\"}")).andExpect(status().is(esperado));
        return esperado == 200 ? resposta(result) : null;
    }
    void editarInvalida(long id, int esperado) throws Exception {
        mvc.perform(put(BASE + "/" + id).header("Authorization", tokenA).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(pedido()))).andExpect(status().is(esperado));
    }
    JsonNode resposta(ResultActions result) throws Exception { return json.readTree(result.andReturn().getResponse().getContentAsString()); }
    void saldo(ContaFinanceiraEntity conta, String esperado) { assertThat(financeiras.findById(conta.getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo(esperado); }
    EmpresaEntity empresa(String nome) { var e = new EmpresaEntity(); e.setRazaoSocial(nome); e.setAtivo(true); return empresas.saveAndFlush(e); }
    UsuarioEntity usuario(EmpresaEntity empresa, String cpf, PerfilUsuario perfil) {
        var u = new UsuarioEntity(); u.setEmpresa(empresa); u.setCpf(cpf); u.setNomeUsuario("Usuario"); u.setSenha("hash"); u.setAtivo(true); u.setPerfil(perfil); return usuarios.saveAndFlush(u);
    }
    ClienteEntity cliente(EmpresaEntity empresa) {
        var c = new ClienteEntity(); c.setEmpresa(empresa); c.setNome("Cliente " + empresa.getRazaoSocial());
        c.setCpfCnpj("02360684663"); c.setTipoPessoa(TipoPessoa.FISICA); return clientes.saveAndFlush(c);
    }
    ContaFinanceiraEntity financeira(EmpresaEntity empresa) { return financeiras.saveAndFlush(new ContaFinanceiraEntity(empresa, "Conta", TipoContaFinanceira.OUTROS, new BigDecimal("0.00"))); }
}
