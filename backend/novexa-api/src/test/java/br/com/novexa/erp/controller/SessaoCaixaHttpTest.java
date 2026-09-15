package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.SessaoCaixaResponseDTO;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.concurrent.*;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:sessao-caixa-http;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver", "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false", "spring.jpa.show-sql=false",
        "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=60000"
})
@AutoConfigureMockMvc
class SessaoCaixaHttpTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired CaixaRepository caixas;
    @Autowired SessaoCaixaRepository sessoes;
    @Autowired SessaoCaixaService service;
    @Autowired JwtService jwt;
    @Autowired PlatformTransactionManager transactions;
    CaixaEntity caixaA, caixaB;
    UsuarioEntity operadorA, operadorB, colegaA;
    UsuarioAutenticado principal;
    String token;

    @BeforeEach
    void preparar() {
        sessoes.deleteAllInBatch();
        caixas.deleteAllInBatch();
        usuarios.deleteAllInBatch();
        empresas.deleteAllInBatch();
        EmpresaEntity a = empresa("A"), b = empresa("B");
        caixaA = caixa(a, "Caixa A"); caixaB = caixa(b, "Caixa B");
        operadorA = usuario(a, "11111111111"); operadorB = usuario(b, "22222222222");
        colegaA = usuario(a, "33333333333");
        principal = new UsuarioAutenticado(operadorA.getId(), operadorA.getCpf(), a.getId(), PerfilUsuario.USUARIO);
        token = token(operadorA);
    }

    @Test
    void cicloRegistraSaldosOperadoresHorariosEHistoricoSemAceitarDadosForjados() throws Exception {
        var resposta = mvc.perform(post(url(caixaA)).header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"saldoInicial\":10.25,\"empresaId\":" + caixaB.getEmpresa().getId()
                                + ",\"usuarioAberturaId\":" + operadorB.getId() + ",\"dataAbertura\":\"2000-01-01T00:00:00\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("ABERTO"))
                .andExpect(jsonPath("$.saldoInicial").value(10.25))
                .andExpect(jsonPath("$.usuarioAberturaId").value(operadorA.getId()))
                .andExpect(jsonPath("$.dataAbertura").exists()).andReturn();
        long id = json.readTree(resposta.getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(get(url(caixaA) + "/aberta").header("Authorization", token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));
        mvc.perform(post(url(caixaA) + "/" + id + "/fechar").header("Authorization", token(colegaA))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"saldoFinal\":8.50}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("FECHADO"))
                .andExpect(jsonPath("$.saldoFinal").value(8.50))
                .andExpect(jsonPath("$.usuarioFechamentoId").value(colegaA.getId()));
        var salvo = sessoes.findById(id).orElseThrow();
        assertThat(salvo.getEmpresa().getId()).isEqualTo(principal.empresaId());
        assertThat(salvo.getDataAbertura().getYear()).isGreaterThan(2000);
        assertThat(salvo.getDataFechamento()).isAfterOrEqualTo(salvo.getDataAbertura());
        mvc.perform(get(url(caixaA) + "/aberta").header("Authorization", token)).andExpect(status().isNotFound());
        var reaberta = service.abrir(caixaA.getId(), BigDecimal.ZERO, principal);
        assertThat(reaberta.id()).isNotEqualTo(id);
        mvc.perform(post(url(caixaA) + "/" + id + "/fechar").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"saldoFinal\":999}"))
                .andExpect(status().isConflict());
        assertThat(service.consultarAberta(caixaA.getId(), principal.empresaId()).id()).isEqualTo(reaberta.id());
        assertThat(sessoes.findById(id).orElseThrow().getSaldoFinal()).isEqualByComparingTo("8.50");
        assertThat(sessoes.count()).isEqualTo(2);
    }

    @Test
    void segundaAberturaRejeitadaECaixaInativoNaoAbreMasPodeFecharSessaoExistente() throws Exception {
        var aberta = service.abrir(caixaA.getId(), BigDecimal.ZERO, principal);
        mvc.perform(post(url(caixaA)).header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"saldoInicial\":1}")).andExpect(status().isConflict());
        caixaA.setAtivo(false); caixas.saveAndFlush(caixaA);
        service.fechar(caixaA.getId(), aberta.id(), BigDecimal.ZERO, principal);
        mvc.perform(post(url(caixaA)).header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"saldoInicial\":1}")).andExpect(status().isConflict());
    }

    @ParameterizedTest
    @ValueSource(strings = {"null", "-0.01", "1.001", "100000000000000000"})
    void validaSaldosNaAberturaEFechamento(String saldo) throws Exception {
        mvc.perform(post(url(caixaA)).header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"saldoInicial\":" + saldo + "}")).andExpect(status().isBadRequest());
        var aberta = service.abrir(caixaA.getId(), BigDecimal.ZERO, principal);
        mvc.perform(post(url(caixaA) + "/" + aberta.id() + "/fechar").header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"saldoFinal\":" + saldo + "}"))
                .andExpect(status().isBadRequest());
        assertThat(sessoes.findById(aberta.id()).orElseThrow().getStatus()).isEqualTo(StatusSessaoCaixa.ABERTO);
    }

    @Test
    void empresaNaoAbreConsultaOuFechaCaixaDeOutraEmpresa() throws Exception {
        var outro = new UsuarioAutenticado(operadorB.getId(), operadorB.getCpf(), caixaB.getEmpresa().getId(), PerfilUsuario.USUARIO);
        var aberta = service.abrir(caixaB.getId(), BigDecimal.TEN, outro);
        mvc.perform(post(url(caixaB)).header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"saldoInicial\":0}")).andExpect(status().isNotFound());
        mvc.perform(get(url(caixaB) + "/aberta").header("Authorization", token)).andExpect(status().isNotFound());
        for (CaixaEntity caixa : new CaixaEntity[]{caixaA, caixaB}) {
            mvc.perform(post(url(caixa) + "/" + aberta.id() + "/fechar").header("Authorization", token)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"saldoFinal\":0}")).andExpect(status().isNotFound());
        }
        assertThat(sessoes.findById(aberta.id()).orElseThrow().getStatus()).isEqualTo(StatusSessaoCaixa.ABERTO);
    }

    @Test
    void rejeitaOperadorInativoOuDeOutraEmpresa() throws Exception {
        operadorA.setAtivo(false); usuarios.saveAndFlush(operadorA);
        mvc.perform(post(url(caixaA)).header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"saldoInicial\":0}")).andExpect(status().isForbidden());
        String forjado = "Bearer " + jwt.gerarToken(operadorB.getId(), operadorB.getCpf(), principal.empresaId(), PerfilUsuario.USUARIO);
        mvc.perform(post(url(caixaA)).header("Authorization", forjado).contentType(MediaType.APPLICATION_JSON)
                .content("{\"saldoInicial\":0}")).andExpect(status().isForbidden());
        assertThat(sessoes.count()).isZero();
    }

    @Test
    void endpointsExigemJwtENaoEncontradoSemSessao() throws Exception {
        mvc.perform(post(url(caixaA))).andExpect(status().isUnauthorized());
        mvc.perform(get(url(caixaA) + "/aberta")).andExpect(status().isUnauthorized());
        mvc.perform(post(url(caixaA) + "/1/fechar")).andExpect(status().isUnauthorized());
        mvc.perform(get(url(caixaA) + "/aberta").header("Authorization", token)).andExpect(status().isNotFound());
    }

    @Test
    void aberturasConcorrentesSerializamPorCaixa() throws Exception {
        concorrentes(() -> service.abrir(caixaA.getId(), BigDecimal.TEN, principal),
                () -> service.abrir(caixaA.getId(), BigDecimal.ONE, principal));
        assertThat(sessoes.count()).isEqualTo(1);
        assertThat(service.consultarAberta(caixaA.getId(), principal.empresaId()).saldoInicial()).isEqualByComparingTo("10");
    }

    @Test
    void fechamentosConcorrentesNaoSobrescrevemSaldoFinal() throws Exception {
        var aberta = service.abrir(caixaA.getId(), BigDecimal.TEN, principal);
        concorrentes(() -> service.fechar(caixaA.getId(), aberta.id(), BigDecimal.ONE, principal),
                () -> service.fechar(caixaA.getId(), aberta.id(), BigDecimal.TEN, principal));
        assertThat(sessoes.findById(aberta.id()).orElseThrow().getSaldoFinal()).isEqualByComparingTo("1");
    }

    @Test
    void erroAposPersistenciaReverteAberturaEFechamento() {
        TransactionTemplate tx = new TransactionTemplate(transactions);
        assertThatThrownBy(() -> tx.executeWithoutResult(s -> {
            service.abrir(caixaA.getId(), BigDecimal.TEN, principal);
            throw new IllegalStateException("falha posterior ao flush");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(sessoes.count()).isZero();
        var aberta = service.abrir(caixaA.getId(), BigDecimal.TEN, principal);
        assertThatThrownBy(() -> tx.executeWithoutResult(s -> {
            service.fechar(caixaA.getId(), aberta.id(), BigDecimal.ONE, principal);
            throw new IllegalStateException("falha posterior ao flush");
        })).isInstanceOf(IllegalStateException.class);
        var atual = sessoes.findById(aberta.id()).orElseThrow();
        assertThat(atual.getStatus()).isEqualTo(StatusSessaoCaixa.ABERTO);
        assertThat(atual.getSaldoFinal()).isNull();
        assertThat(atual.getUsuarioFechamento()).isNull();
    }

    private void concorrentes(Supplier<SessaoCaixaResponseDTO> primeira, Supplier<SessaoCaixaResponseDTO> segunda) throws Exception {
        var pool = Executors.newFixedThreadPool(2);
        var gravou = new CountDownLatch(1);
        var liberar = new CountDownLatch(1);
        var iniciouSegunda = new CountDownLatch(1);
        try {
            var a = pool.submit(() -> new TransactionTemplate(transactions).execute(s -> {
                var resultado = primeira.get();
                gravou.countDown();
                try { if (!liberar.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("timeout"); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); }
                return resultado;
            }));
            assertThat(gravou.await(10, TimeUnit.SECONDS)).isTrue();
            var b = pool.submit(() -> { iniciouSegunda.countDown(); return segunda.get(); });
            assertThat(iniciouSegunda.await(5, TimeUnit.SECONDS)).isTrue();
            assertThatThrownBy(() -> b.get(200, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
            liberar.countDown();
            assertThat(a.get(10, TimeUnit.SECONDS)).isNotNull();
            assertThatThrownBy(() -> b.get(10, TimeUnit.SECONDS)).hasCauseInstanceOf(ResponseStatusException.class)
                    .satisfies(e -> assertThat(((ResponseStatusException) e.getCause()).getStatusCode().value()).isEqualTo(409));
        } finally {
            liberar.countDown();
            pool.shutdownNow();
            assertThat(pool.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }
    }

    private String url(CaixaEntity caixa) { return "/financeiro/caixas/" + caixa.getId() + "/sessoes"; }
    private String token(UsuarioEntity usuario) { return "Bearer " + jwt.gerarToken(usuario.getId(), usuario.getCpf(), usuario.getEmpresa().getId(), PerfilUsuario.USUARIO); }
    private EmpresaEntity empresa(String nome) {
        var e = new EmpresaEntity(); e.setRazaoSocial(nome); e.setAtivo(true); return empresas.saveAndFlush(e);
    }
    private CaixaEntity caixa(EmpresaEntity empresa, String nome) {
        var c = new CaixaEntity(); c.setEmpresa(empresa); c.setDescricao(nome); return caixas.saveAndFlush(c);
    }
    private UsuarioEntity usuario(EmpresaEntity empresa, String cpf) {
        var u = new UsuarioEntity(); u.setEmpresa(empresa); u.setCpf(cpf); u.setNomeUsuario(cpf);
        u.setAtivo(true); return usuarios.saveAndFlush(u);
    }
}
