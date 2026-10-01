package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=${novexa.test.transferencias.http-url:jdbc:h2:mem:transferencias;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000}",
        "spring.datasource.username=${novexa.test.transferencias.http-user:sa}", "spring.datasource.password=",
        "spring.datasource.driver-class-name=${novexa.test.transferencias.http-driver:org.h2.Driver}",
        "spring.jpa.hibernate.ddl-auto=${novexa.test.transferencias.ddl:create-drop}",
        "spring.flyway.enabled=${novexa.test.transferencias.flyway:false}",
        "spring.jpa.open-in-view=false",
        "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=600000"
})
@AutoConfigureMockMvc
class TransferenciaFinanceiraHttpTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired ContaFinanceiraRepository contas;
    @Autowired TransferenciaFinanceiraRepository transferencias;
    @MockitoSpyBean MovimentacaoFinanceiraRepository movimentos;
    @Autowired TransferenciaFinanceiraService service;
    @Autowired JwtService jwt;
    EmpresaEntity empresa, outraEmpresa;
    UsuarioEntity usuario;
    ContaFinanceiraEntity origem, destino, externa;
    String token, tokenOutro;

    @BeforeEach void preparar() {
        empresa = empresa(); outraEmpresa = empresa();
        usuario = usuario(empresa);
        token = "Bearer " + jwt.gerarToken(usuario);
        tokenOutro = "Bearer " + jwt.gerarToken(usuario(outraEmpresa));
        origem = conta(empresa, "Origem", TipoContaFinanceira.COFRE, "1000");
        destino = conta(empresa, "Destino", TipoContaFinanceira.OUTROS, "200");
        externa = conta(outraEmpresa, "Externa", TipoContaFinanceira.COFRE, "1000");
    }

    @Test void transferenciaAtomicaComDoisEfeitosVinculadosEConsultaIsolada() throws Exception {
        long id = id(criar(pedido()).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CONCLUIDA"))
                .andExpect(jsonPath("$.usuarioId").value(usuario.getId())));
        saldos("900", "300");
        var lista = efeitos();
        assertThat(lista).hasSize(2).allSatisfy(m -> {
            assertThat(m.getTransferencia().getId()).isEqualTo(id);
            assertThat(m.getOrigem()).isEqualTo(OrigemMovimentacaoFinanceira.TRANSFERENCIA);
            assertThat(m.getValor()).isEqualByComparingTo("100");
            assertThat(m.isEstornada()).isFalse();
        });
        assertThat(lista).anySatisfy(m -> {
            assertThat(m.getTipo()).isEqualTo(TipoMovimentacaoFinanceira.SAIDA);
            assertThat(m.getContaFinanceira().getId()).isEqualTo(origem.getId());
        }).anySatisfy(m -> {
            assertThat(m.getTipo()).isEqualTo(TipoMovimentacaoFinanceira.ENTRADA);
            assertThat(m.getContaFinanceira().getId()).isEqualTo(destino.getId());
        });
        mvc.perform(get("/financeiro/transferencias").header("Authorization", token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1));
        mvc.perform(get("/financeiro/transferencias").header("Authorization", tokenOutro))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(0));
        mvc.perform(get("/financeiro/movimentacoes-financeiras").header("Authorization", token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].transferenciaId").value(id));
        mvc.perform(post("/financeiro/transferencias/" + id + "/estornar").header("Authorization", tokenOutro)
                .contentType(MediaType.APPLICATION_JSON).content("{\"motivoEstorno\":\"Teste\"}"))
                .andExpect(status().isNotFound());
    }

    @Test void mesmaContaESaldoInsuficienteNaoDeixamEfeitos() throws Exception {
        var p = pedido(); p.put("contaDestinoId", origem.getId());
        criar(p).andExpect(status().isBadRequest());
        p = pedido(); p.put("valor", 1001);
        criar(p).andExpect(status().isConflict());
        intacto();
    }

    @ParameterizedTest @ValueSource(strings = {"origem", "destino"})
    void contaInativaRejeitada(String lado) throws Exception {
        var conta = lado.equals("origem") ? origem : destino;
        conta.situacao(false); contas.saveAndFlush(conta);
        criar(pedido()).andExpect(status().isConflict());
        intacto();
    }

    @ParameterizedTest @ValueSource(strings = {"CAIXA", "ADQUIRENTE"})
    void legadoRejeitadoNasDuasPontas(String tipo) throws Exception {
        var legada = conta(empresa, "Legada", TipoContaFinanceira.valueOf(tipo), "1000");
        for (String campo : List.of("contaOrigemId", "contaDestinoId")) {
            var p = pedido(); p.put(campo, legada.getId());
            criar(p).andExpect(status().isConflict());
        }
        intacto();
    }

    @ParameterizedTest @ValueSource(strings = {"contaOrigemId", "contaDestinoId"})
    void crossTenantRetorna404(String campo) throws Exception {
        var p = pedido(); p.put(campo, externa.getId()); p.put("empresaId", outraEmpresa.getId());
        criar(p).andExpect(status().isNotFound());
        intacto();
    }

    @ParameterizedTest @ValueSource(strings = {"0", "-1", "0.001"})
    void valorInvalidoRejeitado(String valor) throws Exception {
        var p = pedido(); p.put("valor", new BigDecimal(valor));
        criar(p).andExpect(status().isBadRequest());
        intacto();
    }

    @ParameterizedTest @ValueSource(strings = {"contaOrigemId", "contaDestinoId", "dataMovimento", "chaveRequisicao", "valor"})
    void camposObrigatorios(String campo) throws Exception {
        var p = pedido(); p.remove(campo);
        criar(p).andExpect(status().isBadRequest());
        intacto();
    }

    @Test void replayPreservaIdentidadeMesmoAposEstornoEInativacao() throws Exception {
        var p = pedido();
        var primeira = criar(p).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long id = json.readTree(primeira).get("id").asLong();
        p.put("valor", new BigDecimal("100.00")); p.put("observacao", " Reserva ");
        criar(p).andExpect(status().isOk()).andExpect(content().json(primeira));
        saldos("900", "300"); assertThat(efeitos()).hasSize(2);
        estornar(id).andExpect(status().isOk());
        origem = contas.findById(origem.getId()).orElseThrow();
        origem.situacao(false); contas.saveAndFlush(origem);
        criar(p).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.status").value("ESTORNADA"));
        saldos("1000", "200"); assertThat(efeitos()).hasSize(2);
    }

    @ParameterizedTest @ValueSource(strings = {"valor", "contaOrigemId", "contaDestinoId", "observacao", "dataMovimento"})
    void mesmaChaveComDadosDiferentesConflita(String campo) throws Exception {
        var p = pedido(); criar(p).andExpect(status().isOk());
        p.put(campo, switch (campo) {
            case "valor" -> 101;
            case "contaOrigemId", "contaDestinoId" -> externa.getId();
            case "observacao" -> "Outra";
            default -> "2026-09-29";
        });
        criar(p).andExpect(status().isConflict());
        saldos("900", "300"); assertThat(efeitos()).hasSize(2);
    }

    @Test void estornoAtomicoInclusiveContasInativasEDuplicadoBloqueado() throws Exception {
        long id = id(criar(pedido()).andExpect(status().isOk()));
        for (var conta : List.of(origem, destino)) {
            var atual = contas.findById(conta.getId()).orElseThrow();
            atual.situacao(false); contas.saveAndFlush(atual);
        }
        estornar(id).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ESTORNADA"))
                .andExpect(jsonPath("$.usuarioEstornoId").value(usuario.getId()))
                .andExpect(jsonPath("$.motivoEstorno").value("Correção"))
                .andExpect(jsonPath("$.dataEstorno").isNotEmpty());
        saldos("1000", "200");
        assertThat(efeitos()).hasSize(2).allSatisfy(m -> {
            assertThat(m.isEstornada()).isTrue();
            assertThat(m.getDataEstorno()).isNotNull();
            assertThat(m.getUsuarioEstorno().getId()).isEqualTo(usuario.getId());
            assertThat(m.getMotivoEstorno()).isEqualTo("Correção");
        });
        estornar(id).andExpect(status().isConflict());
        saldos("1000", "200");
    }

    @Test void estornoIndividualBloqueadoEMotivoObrigatorio() throws Exception {
        long id = id(criar(pedido()).andExpect(status().isOk()));
        for (var m : efeitos()) {
            mvc.perform(patch("/financeiro/movimentacoes-financeiras/" + m.getId() + "/estorno")
                    .header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"motivoEstorno\":\"Teste\"}"))
                    .andExpect(status().isConflict()).andExpect(content().string(org.hamcrest.Matchers.containsString("/transferencias/")));
        }
        mvc.perform(post("/financeiro/transferencias/" + id + "/estornar").header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"motivoEstorno\":\" \"}"))
                .andExpect(status().isBadRequest());
        saldos("900", "300");
    }

    @Test void destinoSemSaldoNaoEstornaNada() throws Exception {
        long id = id(criar(pedido()).andExpect(status().isOk()));
        var atual = contas.findById(destino.getId()).orElseThrow();
        atual.aplicar(new BigDecimal("-250")); contas.saveAndFlush(atual);
        estornar(id).andExpect(status().isConflict());
        saldos("900", "50");
        assertThat(efeitos()).allSatisfy(m -> assertThat(m.isEstornada()).isFalse());
        assertThat(transferencias.findById(id).orElseThrow().getStatus()).isEqualTo(StatusTransferenciaFinanceira.CONCLUIDA);
    }

    @Test void falhaNoSegundoMovimentoDesfazAgregadoSaldosEPrimeiroMovimento() {
        var chamadas = new AtomicInteger();
        doAnswer(invocation -> {
            if (chamadas.incrementAndGet() == 2) throw new IllegalStateException("Falha simulada");
            var salvo = movimentos.save((MovimentacaoFinanceiraEntity) invocation.getArgument(0));
            movimentos.flush();
            return salvo;
        }).when(movimentos).saveAndFlush(any(MovimentacaoFinanceiraEntity.class));
        try {
            assertThatThrownBy(() -> service.criar(empresa.getId(), usuario.getId(), dto(origem, destino, UUID.randomUUID())))
                    .isInstanceOf(IllegalStateException.class).hasMessage("Falha simulada");
            intacto();
        } finally { reset(movimentos); }
    }

    @Test void concorrenciaEmDirecoesOpostasPreservaSaldos() throws Exception {
        paralelo(() -> service.criar(empresa.getId(), usuario.getId(), dto(origem, destino, UUID.randomUUID())),
                () -> service.criar(empresa.getId(), usuario.getId(), dto(destino, origem, UUID.randomUUID())));
        saldos("1000", "200"); assertThat(efeitos()).hasSize(4);
    }

    @Test void retriesConcorrentesGeramUmaUnicaTransferencia() throws Exception {
        var p = dto(origem, destino, UUID.randomUUID());
        var resultados = paralelo(() -> service.criar(empresa.getId(), usuario.getId(), p),
                () -> service.criar(empresa.getId(), usuario.getId(), p));
        assertThat(resultados.get(0).id()).isEqualTo(resultados.get(1).id());
        saldos("900", "300"); assertThat(efeitos()).hasSize(2);
    }

    @Test void chaveConcorrenteEmContasDistintasTemUmVencedor() throws Exception {
        var terceira = conta(empresa, "Terceira", TipoContaFinanceira.COFRE, "1000");
        var quarta = conta(empresa, "Quarta", TipoContaFinanceira.COFRE, "1000");
        var chave = UUID.randomUUID();
        var resultados = paralelo(() -> tentar(dto(origem, destino, chave)), () -> tentar(dto(terceira, quarta, chave)));
        assertThat(resultados).containsExactlyInAnyOrder("OK", "409 CONFLICT");
        assertThat(service.listar(empresa.getId())).hasSize(1);
        assertThat(efeitos()).hasSize(2);
        assertThat(contas.findByEmpresaIdOrderByNomeAscIdAsc(empresa.getId()).stream()
                .map(ContaFinanceiraEntity::getSaldoAtual).reduce(BigDecimal.ZERO, BigDecimal::add))
                .isEqualByComparingTo("3200");
    }

    private String tentar(TransferenciaFinanceiraCriacaoDTO p) {
        try { service.criar(empresa.getId(), usuario.getId(), p); return "OK"; }
        catch (org.springframework.web.server.ResponseStatusException e) { return e.getStatusCode().toString(); }
    }
    private <T> List<T> paralelo(Callable<T> a, Callable<T> b) throws Exception {
        var barreira = new CyclicBarrier(2);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var um = executor.submit(() -> { barreira.await(5, TimeUnit.SECONDS); return a.call(); });
            var dois = executor.submit(() -> { barreira.await(5, TimeUnit.SECONDS); return b.call(); });
            return List.of(um.get(20, TimeUnit.SECONDS), dois.get(20, TimeUnit.SECONDS));
        }
    }
    private TransferenciaFinanceiraCriacaoDTO dto(ContaFinanceiraEntity a, ContaFinanceiraEntity b, UUID chave) {
        return new TransferenciaFinanceiraCriacaoDTO(chave, a.getId(), b.getId(), new BigDecimal("100"),
                LocalDate.of(2026, 9, 30), "Reserva");
    }
    private Map<String, Object> pedido() {
        var p = new HashMap<String, Object>();
        p.put("chaveRequisicao", UUID.randomUUID()); p.put("contaOrigemId", origem.getId());
        p.put("contaDestinoId", destino.getId()); p.put("valor", 100); p.put("dataMovimento", "2026-09-30");
        p.put("observacao", "Reserva"); return p;
    }
    private ResultActions criar(Map<String, Object> p) throws Exception {
        return mvc.perform(post("/financeiro/transferencias").header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(p)));
    }
    private ResultActions estornar(long id) throws Exception {
        return mvc.perform(post("/financeiro/transferencias/" + id + "/estornar").header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"motivoEstorno\":\"Correção\"}"));
    }
    private long id(ResultActions r) throws Exception { return json.readTree(r.andReturn().getResponse().getContentAsString()).get("id").asLong(); }
    private List<MovimentacaoFinanceiraEntity> efeitos() { return movimentos.findByEmpresaIdOrderByDataMovimentoDescIdDesc(empresa.getId()); }
    private void saldos(String a, String b) {
        assertThat(contas.findById(origem.getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo(a);
        assertThat(contas.findById(destino.getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo(b);
    }
    private void intacto() {
        saldos("1000", "200"); assertThat(efeitos()).isEmpty(); assertThat(service.listar(empresa.getId())).isEmpty();
    }
    private EmpresaEntity empresa() {
        var e = new EmpresaEntity(); e.setRazaoSocial("Teste"); e.setAtivo(true); return empresas.saveAndFlush(e);
    }
    private UsuarioEntity usuario(EmpresaEntity e) {
        var u = new UsuarioEntity(); u.setEmpresa(e); u.setCpf(String.format("%011d", e.getId()));
        u.setNomeUsuario("Admin"); u.setSenha("hash"); u.setAtivo(true); u.setPerfil(PerfilUsuario.ADMIN);
        return usuarios.saveAndFlush(u);
    }
    private ContaFinanceiraEntity conta(EmpresaEntity e, String nome, TipoContaFinanceira tipo, String saldo) {
        return contas.saveAndFlush(new ContaFinanceiraEntity(e, nome, tipo, new BigDecimal(saldo)));
    }
}
