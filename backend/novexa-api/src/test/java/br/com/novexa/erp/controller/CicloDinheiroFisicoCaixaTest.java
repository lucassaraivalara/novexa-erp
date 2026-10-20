package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:ciclo-caixa-test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver", "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false", "spring.jpa.show-sql=false",
        "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=60000"
})
@AutoConfigureMockMvc
class CicloDinheiroFisicoCaixaTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired CaixaRepository caixas;
    @Autowired SessaoCaixaRepository sessoes;
    @Autowired ContaFinanceiraRepository contas;
    @Autowired MovimentacaoFinanceiraRepository movimentosFinanceiros;
    @Autowired MovimentacaoCaixaRepository movimentosCaixa;
    @Autowired RecolhimentoCofreRepository recolhimentosCofre;
    @MockitoSpyBean AberturaCaixaOrigemRepository aberturasOrigem;
    @Autowired SessaoCaixaService sessaoService;
    @Autowired CofreService cofreService;
    @Autowired CaixaOperacionalService operacionalService;
    @Autowired JwtService jwt;
    @Autowired PlatformTransactionManager transactions;

    EmpresaEntity empresaA, empresaB;
    UsuarioEntity gerenteA, operadorA1, operadorA2, operadorB;
    CaixaEntity caixaA1, caixaA2, caixaB1;
    ContaFinanceiraEntity cofreA;

    String tokenGerenteA, tokenOperadorA1, tokenOperadorA2, tokenOperadorB;

    @BeforeEach
    void setup() {
        reset(aberturasOrigem);
        aberturasOrigem.deleteAllInBatch();
        recolhimentosCofre.deleteAllInBatch();
        movimentosCaixa.deleteAllInBatch();
        sessoes.deleteAllInBatch();
        movimentosFinanceiros.deleteAllInBatch();
        contas.deleteAllInBatch();
        caixas.deleteAllInBatch();
        usuarios.deleteAllInBatch();
        empresas.deleteAllInBatch();

        empresaA = empresa("Empresa A");
        empresaB = empresa("Empresa B");

        gerenteA = usuario(empresaA, "11111111111", PerfilUsuario.GERENTE);
        operadorA1 = usuario(empresaA, "22222222222", PerfilUsuario.OPERADOR);
        operadorA2 = usuario(empresaA, "33333333333", PerfilUsuario.OPERADOR);
        operadorB = usuario(empresaB, "44444444444", PerfilUsuario.OPERADOR);

        tokenGerenteA = token(gerenteA);
        tokenOperadorA1 = token(operadorA1);
        tokenOperadorA2 = token(operadorA2);
        tokenOperadorB = token(operadorB);

        caixaA1 = caixa(empresaA, "Caixa 01");
        caixaA2 = caixa(empresaA, "Caixa 02");
        caixaB1 = caixa(empresaB, "Caixa B01");

        cofreA = contas.saveAndFlush(new ContaFinanceiraEntity(
                empresaA, "Cofre Principal", TipoContaFinanceira.COFRE, new BigDecimal("500.00")));
    }

    private EmpresaEntity empresa(String nome) {
        var e = new EmpresaEntity();
        e.setRazaoSocial(nome);
        e.setAtivo(true);
        return empresas.saveAndFlush(e);
    }

    private CaixaEntity caixa(EmpresaEntity emp, String nome) {
        var c = new CaixaEntity();
        c.setEmpresa(emp);
        c.setDescricao(nome);
        c.setAtivo(true);
        return caixas.saveAndFlush(c);
    }

    private UsuarioEntity usuario(EmpresaEntity emp, String cpf, PerfilUsuario perfil) {
        var u = new UsuarioEntity();
        u.setEmpresa(emp);
        u.setCpf(cpf);
        u.setNomeUsuario(cpf);
        u.setPerfil(perfil);
        u.setAtivo(true);
        return usuarios.saveAndFlush(u);
    }

    private String token(UsuarioEntity u) {
        return "Bearer " + jwt.gerarToken(u);
    }

    // 1. Fechamento retém troco e 2. Contexto da próxima abertura encontra troco
    @Test
    void fechamentoRetemTrocoEProximaAberturaEncontraNoContexto() throws Exception {
        var authOp = new UsuarioAutenticado(operadorA1.getId(), operadorA1.getCpf(), empresaA.getId(), operadorA1.getPerfil());
        var s1 = sessaoService.abrir(caixaA1.getId(), new BigDecimal("100.00"), authOp);

        var dtoFechamento = new FechamentoCaixaDTO(
                new BigDecimal("155.30"),
                null,
                new EntregaCofreDTO(cofreA.getId(), new BigDecimal("55.30"), new BigDecimal("100.00"),
                        "Gerente João", "Fechamento dia", true)
        );
        sessaoService.fechar(caixaA1.getId(), s1.id(), dtoFechamento, authOp);

        var cofreAtual = contas.findById(cofreA.getId()).orElseThrow();
        assertThat(cofreAtual.getSaldoAtual()).isEqualByComparingTo("555.30");

        mvc.perform(get("/financeiro/caixas/{caixaId}/abertura-contexto", caixaA1.getId())
                        .header("Authorization", tokenOperadorA1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.caixaId").value(caixaA1.getId()))
                .andExpect(jsonPath("$.sessaoAberta").value(false))
                .andExpect(jsonPath("$.trocoAnterior.sessaoId").value(s1.id()))
                .andExpect(jsonPath("$.trocoAnterior.valor").value(100.00))
                .andExpect(jsonPath("$.saldoSugerido").value(100.00))
                .andExpect(jsonPath("$.cofres[0].id").value(cofreA.getId()))
                .andExpect(jsonPath("$.cofres[0].saldoAtual").value(555.30));
    }

    // 3. Mesma sessão origem não pode ser consumida duas vezes
    @Test
    void mesmaSessaoOrigemNaoPodeSerConsumidaDuasVezes() throws Exception {
        var authOp1 = new UsuarioAutenticado(operadorA1.getId(), operadorA1.getCpf(), empresaA.getId(), operadorA1.getPerfil());
        var s1 = sessaoService.abrir(caixaA1.getId(), new BigDecimal("100.00"), authOp1);

        sessaoService.fechar(caixaA1.getId(), s1.id(), new FechamentoCaixaDTO(
                new BigDecimal("100.00"),
                null,
                new EntregaCofreDTO(null, BigDecimal.ZERO, new BigDecimal("100.00"), null, null, false)
        ), authOp1);

        var reqAbertura2 = new AberturaCaixaDTO(
                new BigDecimal("100.00"), UUID.randomUUID(), true, BigDecimal.ZERO, null, BigDecimal.ZERO, null
        );
        var s2 = sessaoService.abrir(caixaA1.getId(), reqAbertura2, authOp1);
        assertThat(s2).isNotNull();

        sessaoService.fechar(caixaA1.getId(), s2.id(), new FechamentoCaixaDTO(
                new BigDecimal("100.00"),
                null,
                new EntregaCofreDTO(cofreA.getId(), new BigDecimal("100.00"), BigDecimal.ZERO, "Resp", null, true)
        ), authOp1);

        mvc.perform(get("/financeiro/caixas/{caixaId}/abertura-contexto", caixaA1.getId())
                        .header("Authorization", tokenOperadorA1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trocoAnterior").doesNotExist())
                .andExpect(jsonPath("$.saldoSugerido").value(0.00));
    }

    // 4. Caixa diferente não herda troco
    @Test
    void caixaDiferenteNaoHerdaTroco() throws Exception {
        var authOp1 = new UsuarioAutenticado(operadorA1.getId(), operadorA1.getCpf(), empresaA.getId(), operadorA1.getPerfil());
        var s1 = sessaoService.abrir(caixaA1.getId(), new BigDecimal("100.00"), authOp1);

        sessaoService.fechar(caixaA1.getId(), s1.id(), new FechamentoCaixaDTO(
                new BigDecimal("100.00"),
                null,
                new EntregaCofreDTO(null, BigDecimal.ZERO, new BigDecimal("100.00"), null, null, false)
        ), authOp1);

        mvc.perform(get("/financeiro/caixas/{caixaId}/abertura-contexto", caixaA2.getId())
                        .header("Authorization", tokenOperadorA1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.caixaId").value(caixaA2.getId()))
                .andExpect(jsonPath("$.trocoAnterior").doesNotExist())
                .andExpect(jsonPath("$.saldoSugerido").value(0.00));
    }

    // 5. Empresa diferente não herda troco (isolamento multi-tenant)
    @Test
    void empresaDiferenteNaoHerda() throws Exception {
        var authOp1 = new UsuarioAutenticado(operadorA1.getId(), operadorA1.getCpf(), empresaA.getId(), operadorA1.getPerfil());
        var s1 = sessaoService.abrir(caixaA1.getId(), new BigDecimal("100.00"), authOp1);

        sessaoService.fechar(caixaA1.getId(), s1.id(), new FechamentoCaixaDTO(
                new BigDecimal("100.00"),
                null,
                new EntregaCofreDTO(null, BigDecimal.ZERO, new BigDecimal("100.00"), null, null, false)
        ), authOp1);

        mvc.perform(get("/financeiro/caixas/{caixaId}/abertura-contexto", caixaA1.getId())
                        .header("Authorization", tokenOperadorB))
                .andExpect(status().isNotFound());
    }

    // 6. Operador diferente pode abrir o mesmo Caixa com troco (custódia pertence ao Caixa)
    // 7. Troco herdado não gera movimentação financeira
    @Test
    void operadorDiferentePodeAbrirMesmoCaixaComTrocoESemMovimentoFinanceiro() throws Exception {
        var authOp1 = new UsuarioAutenticado(operadorA1.getId(), operadorA1.getCpf(), empresaA.getId(), operadorA1.getPerfil());
        var authOp2 = new UsuarioAutenticado(operadorA2.getId(), operadorA2.getCpf(), empresaA.getId(), operadorA2.getPerfil());

        var s1 = sessaoService.abrir(caixaA1.getId(), new BigDecimal("100.00"), authOp1);
        sessaoService.fechar(caixaA1.getId(), s1.id(), new FechamentoCaixaDTO(
                new BigDecimal("100.00"), null,
                new EntregaCofreDTO(null, BigDecimal.ZERO, new BigDecimal("100.00"), null, null, false)
        ), authOp1);

        int contagemMovimentosAntes = movimentosFinanceiros.findAll().size();

        var req = new AberturaCaixaDTO(
                new BigDecimal("100.00"), UUID.randomUUID(), true, BigDecimal.ZERO, null, BigDecimal.ZERO, null
        );
        var s2 = sessaoService.abrir(caixaA1.getId(), req, authOp2);

        assertThat(s2.saldoInicial()).isEqualByComparingTo("100.00");
        assertThat(s2.usuarioAberturaId()).isEqualTo(operadorA2.getId());

        int contagemMovimentosDepois = movimentosFinanceiros.findAll().size();
        assertThat(contagemMovimentosDepois).isEqualTo(contagemMovimentosAntes);
    }

    // 8. Retirada do COFRE debita exatamente uma vez
    @Test
    void retiradaCofreDebitaExatamenteUmaVez() throws Exception {
        var authGerente = new UsuarioAutenticado(gerenteA.getId(), gerenteA.getCpf(), empresaA.getId(), gerenteA.getPerfil());
        BigDecimal saldoInicialCofre = contas.findById(cofreA.getId()).orElseThrow().getSaldoAtual();
        assertThat(saldoInicialCofre).isEqualByComparingTo("500.00");

        var req = new AberturaCaixaDTO(
                new BigDecimal("100.00"), UUID.randomUUID(), false, new BigDecimal("100.00"), cofreA.getId(), BigDecimal.ZERO, null
        );
        var s = sessaoService.abrir(caixaA1.getId(), req, authGerente);
        assertThat(s.saldoInicial()).isEqualByComparingTo("100.00");

        var cofreDepois = contas.findById(cofreA.getId()).orElseThrow();
        assertThat(cofreDepois.getSaldoAtual()).isEqualByComparingTo("400.00");

        var movimentos = movimentosFinanceiros.findAll();
        assertThat(movimentos).hasSize(1);
        var mov = movimentos.getFirst();
        assertThat(mov.getTipo()).isEqualTo(TipoMovimentacaoFinanceira.SAIDA);
        assertThat(mov.getOrigem()).isEqualTo(OrigemMovimentacaoFinanceira.MOVIMENTO_COFRE);
        assertThat(mov.getValor()).isEqualByComparingTo("100.00");
    }

    // 9. Complemento troco + COFRE (R$ 70 troco herdado + R$ 30 cofre = R$ 100 saldo inicial)
    @Test
    void complementoTrocoMaisCofre() throws Exception {
        var authGerente = new UsuarioAutenticado(gerenteA.getId(), gerenteA.getCpf(), empresaA.getId(), gerenteA.getPerfil());

        var s1 = sessaoService.abrir(caixaA1.getId(), new BigDecimal("70.00"), authGerente);
        sessaoService.fechar(caixaA1.getId(), s1.id(), new FechamentoCaixaDTO(
                new BigDecimal("70.00"), null,
                new EntregaCofreDTO(null, BigDecimal.ZERO, new BigDecimal("70.00"), null, null, false)
        ), authGerente);

        var req = new AberturaCaixaDTO(
                new BigDecimal("100.00"), UUID.randomUUID(), true, new BigDecimal("30.00"), cofreA.getId(), BigDecimal.ZERO, null
        );
        var s2 = sessaoService.abrir(caixaA1.getId(), req, authGerente);

        assertThat(s2.saldoInicial()).isEqualByComparingTo("100.00");

        var cofreDepois = contas.findById(cofreA.getId()).orElseThrow();
        assertThat(cofreDepois.getSaldoAtual()).isEqualByComparingTo("470.00");

        var origem = aberturasOrigem.findBySessaoId(s2.id()).orElseThrow();
        assertThat(origem.getValorTrocoHerdado()).isEqualByComparingTo("70.00");
        assertThat(origem.getValorRetiradoCofre()).isEqualByComparingTo("30.00");
        assertThat(origem.getSessaoOrigemTroco().getId()).isEqualTo(s1.id());
    }

    // 10. Saldo insuficiente no COFRE gera rollback
    // 11. Falha não deixa saldo parcial
    @Test
    void saldoInsuficienteGeraRollbackSemEfeitoParcial() throws Exception {
        var req = new AberturaCaixaDTO(
                new BigDecimal("600.00"), UUID.randomUUID(), false, new BigDecimal("600.00"), cofreA.getId(), BigDecimal.ZERO, null
        );

        mvc.perform(post("/financeiro/caixas/{caixaId}/sessoes", caixaA1.getId())
                        .header("Authorization", tokenGerenteA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(req)))
                .andExpect(status().isConflict());

        var cofreDepois = contas.findById(cofreA.getId()).orElseThrow();
        assertThat(cofreDepois.getSaldoAtual()).isEqualByComparingTo("500.00");

        assertThat(sessoes.findAll()).isEmpty();
        assertThat(movimentosFinanceiros.findAll()).isEmpty();
    }

    // 12. Retry com mesma chave não debita duas vezes (Idempotência)
    @Test
    void retryNaoDebitaDuasVezes() throws Exception {
        var authGerente = new UsuarioAutenticado(gerenteA.getId(), gerenteA.getCpf(), empresaA.getId(), gerenteA.getPerfil());
        UUID chave = UUID.randomUUID();

        var req = new AberturaCaixaDTO(
                new BigDecimal("100.00"), chave, false, new BigDecimal("100.00"), cofreA.getId(), BigDecimal.ZERO, null
        );

        var s1 = sessaoService.abrir(caixaA1.getId(), req, authGerente);
        assertThat(contas.findById(cofreA.getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo("400.00");

        var s2 = sessaoService.abrir(caixaA1.getId(), req, authGerente);
        assertThat(s2.id()).isEqualTo(s1.id());

        assertThat(contas.findById(cofreA.getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo("400.00");
        assertThat(movimentosFinanceiros.findAll()).hasSize(1);
    }

    // 13. Concorrência: duas aberturas na mesma sessão/caixa
    @Test
    void segundaAberturaNoMesmoCaixaGeraConflito() throws Exception {
        var authOp1 = new UsuarioAutenticado(operadorA1.getId(), operadorA1.getCpf(), empresaA.getId(), operadorA1.getPerfil());
        sessaoService.abrir(caixaA1.getId(), new BigDecimal("50.00"), authOp1);

        mvc.perform(post("/financeiro/caixas/{caixaId}/sessoes", caixaA1.getId())
                        .header("Authorization", tokenOperadorA1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"saldoInicial\":50.00}"))
                .andExpect(status().isConflict());
    }

    // 14. Aporte externo auditado (exige observação, não gera movimento financeiro)
    @Test
    void aporteExternoAuditado() throws Exception {
        var authGerente = new UsuarioAutenticado(gerenteA.getId(), gerenteA.getCpf(), empresaA.getId(), gerenteA.getPerfil());

        var reqSemObs = new AberturaCaixaDTO(
                new BigDecimal("100.00"), UUID.randomUUID(), false, BigDecimal.ZERO, null, new BigDecimal("100.00"), "   "
        );
        mvc.perform(post("/financeiro/caixas/{caixaId}/sessoes", caixaA1.getId())
                        .header("Authorization", tokenGerenteA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(reqSemObs)))
                .andExpect(status().isBadRequest());

        var reqComObs = new AberturaCaixaDTO(
                new BigDecimal("100.00"), UUID.randomUUID(), false, BigDecimal.ZERO, null, new BigDecimal("100.00"), "Fundo colocado do bolso do proprietário"
        );
        var s = sessaoService.abrir(caixaA1.getId(), reqComObs, authGerente);
        assertThat(s.saldoInicial()).isEqualByComparingTo("100.00");

        assertThat(movimentosFinanceiros.findAll()).isEmpty();

        var origem = aberturasOrigem.findBySessaoId(s.id()).orElseThrow();
        assertThat(origem.getValorAporteExterno()).isEqualByComparingTo("100.00");
        assertThat(origem.getObservacaoAporte()).isEqualTo("Fundo colocado do bolso do proprietário");
    }

    // 15. Fechamento com troco zero (tudo para o cofre)
    @Test
    void fechamentoComTrocoZeroNaoSugereTrocoNaProximaAbertura() throws Exception {
        var authOp = new UsuarioAutenticado(operadorA1.getId(), operadorA1.getCpf(), empresaA.getId(), operadorA1.getPerfil());
        var s1 = sessaoService.abrir(caixaA1.getId(), new BigDecimal("100.00"), authOp);

        sessaoService.fechar(caixaA1.getId(), s1.id(), new FechamentoCaixaDTO(
                new BigDecimal("100.00"), null,
                new EntregaCofreDTO(cofreA.getId(), new BigDecimal("100.00"), BigDecimal.ZERO, "Resp", null, true)
        ), authOp);

        mvc.perform(get("/financeiro/caixas/{caixaId}/abertura-contexto", caixaA1.getId())
                        .header("Authorization", tokenOperadorA1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trocoAnterior").doesNotExist())
                .andExpect(jsonPath("$.saldoSugerido").value(0.00));
    }

    // 16. Fechamento com recolhimento zero (tudo para troco)
    @Test
    void fechamentoComRecolhimentoZeroSugereIntegralmenteTroco() throws Exception {
        var authOp = new UsuarioAutenticado(operadorA1.getId(), operadorA1.getCpf(), empresaA.getId(), operadorA1.getPerfil());
        var s1 = sessaoService.abrir(caixaA1.getId(), new BigDecimal("155.30"), authOp);

        sessaoService.fechar(caixaA1.getId(), s1.id(), new FechamentoCaixaDTO(
                new BigDecimal("155.30"), null,
                new EntregaCofreDTO(null, BigDecimal.ZERO, new BigDecimal("155.30"), null, null, false)
        ), authOp);

        mvc.perform(get("/financeiro/caixas/{caixaId}/abertura-contexto", caixaA1.getId())
                        .header("Authorization", tokenOperadorA1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trocoAnterior.valor").value(155.30))
                .andExpect(jsonPath("$.saldoSugerido").value(155.30));
    }

    // 17. Históricos antigos continuam legíveis no detalhe
    @Test
    void historicoAntigoSemOrigemAberturaPermaneceLegivelNoDetalhe() throws Exception {
        var authOp = new UsuarioAutenticado(operadorA1.getId(), operadorA1.getCpf(), empresaA.getId(), operadorA1.getPerfil());

        var s = sessaoService.abrir(caixaA1.getId(), new BigDecimal("50.00"), authOp);
        sessaoService.fechar(caixaA1.getId(), s.id(), new BigDecimal("50.00"), authOp);

        var detalhe = operacionalService.detalhe(s.id(), authOp);
        assertThat(detalhe).isNotNull();
        assertThat(detalhe.composicaoAbertura()).isNull();
        assertThat(detalhe.sessao().saldoInicial()).isEqualByComparingTo("50.00");
    }

    // Validação obrigatória da regra 39: Troco maior que o fundo desejado bloqueia com mensagem operacional
    @Test
    void trocoMaiorQueFundoDesejadoBloqueiaAbertura() throws Exception {
        var authOp = new UsuarioAutenticado(operadorA1.getId(), operadorA1.getCpf(), empresaA.getId(), operadorA1.getPerfil());
        var s1 = sessaoService.abrir(caixaA1.getId(), new BigDecimal("100.00"), authOp);
        sessaoService.fechar(caixaA1.getId(), s1.id(), new FechamentoCaixaDTO(
                new BigDecimal("100.00"), null,
                new EntregaCofreDTO(null, BigDecimal.ZERO, new BigDecimal("100.00"), null, null, false)
        ), authOp);

        var req = new AberturaCaixaDTO(
                new BigDecimal("80.00"), UUID.randomUUID(), true, BigDecimal.ZERO, null, BigDecimal.ZERO, null
        );

        mvc.perform(post("/financeiro/caixas/{caixaId}/sessoes", caixaA1.getId())
                        .header("Authorization", tokenOperadorA1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(req)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$").value(org.hamcrest.Matchers.containsString("Existem R$ 100,00 de troco sob custódia deste Caixa. Regularize o excedente antes de abrir com valor menor.")));
    }

    UsuarioAutenticado auth(UsuarioEntity u) {
        return new UsuarioAutenticado(u.getId(), u.getCpf(), u.getEmpresa().getId(), u.getPerfil());
    }

    AberturaCaixaDTO retirada(String valor, UUID chave) {
        return new AberturaCaixaDTO(new BigDecimal(valor), chave, false, new BigDecimal(valor), cofreA.getId(), BigDecimal.ZERO, null);
    }

    @Test void origemDoComplementoNaoDuplicaSaldoEsperadoEHistoricoMostraComposicao() {
        var s = sessaoService.abrir(caixaA1.getId(), retirada("100.00", UUID.randomUUID()), auth(gerenteA));
        var resumo = operacionalService.resumo(s.id(), empresaA.getId());
        assertThat(resumo.saldoEsperadoDinheiro()).isEqualByComparingTo("100");
        assertThat(resumo.suprimentos()).isEqualByComparingTo("0");
        sessaoService.fechar(caixaA1.getId(), s.id(), new BigDecimal("100"), auth(gerenteA));
        var detalhe = operacionalService.detalhe(s.id(), auth(gerenteA));
        assertThat(detalhe.composicaoAbertura().valorRetiradoCofre()).isEqualByComparingTo("100");
        assertThat(detalhe.composicaoAbertura().movimentoFinanceiroId()).isNotNull();
    }

    @Test void falhaDepoisDoDebitoDesfazContaSessaoMovimentosEAuditoria() {
        doThrow(new IllegalStateException("Falha sintética após débito")).when(aberturasOrigem).saveAndFlush(any());
        try {
            assertThatThrownBy(() -> sessaoService.abrir(caixaA1.getId(), retirada("100.00", UUID.randomUUID()), auth(gerenteA)))
                    .isInstanceOf(IllegalStateException.class);
        } finally { reset(aberturasOrigem); }
        assertThat(contas.findById(cofreA.getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo("500");
        assertThat(sessoes.count()).isZero();
        assertThat(movimentosFinanceiros.count()).isZero();
        assertThat(movimentosCaixa.count()).isZero();
        assertThat(aberturasOrigem.count()).isZero();
    }

    @Test void repeticaoComOutraOrigemOuOperadorGeraConflitoSemNovoDebito() {
        UUID chave = UUID.randomUUID();
        sessaoService.abrir(caixaA1.getId(), retirada("100.00", chave), auth(gerenteA));
        var modificado = new AberturaCaixaDTO(new BigDecimal("100.00"), chave, false,
                BigDecimal.ZERO, null, new BigDecimal("100.00"), "Outra origem");
        for (var pedido : java.util.List.of(modificado, retirada("101.00", chave)))
            assertThatThrownBy(() -> sessaoService.abrir(caixaA1.getId(), pedido, auth(gerenteA)))
                    .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
                    .hasMessageContaining("409");
        assertThatThrownBy(() -> sessaoService.abrir(caixaA1.getId(), retirada("100.00", chave), auth(operadorA2)))
                .hasMessageContaining("409");
        assertThat(contas.findById(cofreA.getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo("400");
        assertThat(movimentosFinanceiros.count()).isEqualTo(1);
    }

    @Test void contratoLegadoNaoPodeIgnorarTrocoSobCustodia() {
        var s = sessaoService.abrir(caixaA1.getId(), new BigDecimal("100"), auth(operadorA1));
        sessaoService.fechar(caixaA1.getId(), s.id(), new FechamentoCaixaDTO(new BigDecimal("100"), null,
                new EntregaCofreDTO(null, BigDecimal.ZERO, new BigDecimal("100"), null, null, false)), auth(operadorA1));
        assertThatThrownBy(() -> sessaoService.abrir(caixaA1.getId(), new BigDecimal("100"), auth(operadorA2)))
                .hasMessageContaining("Confirme a utilização");
        assertThat(sessoes.count()).isEqualTo(1);
    }

    @Test void dadosInvalidosSemEfeitoParcial() throws Exception {
        var valido = json.readTree(json.writeValueAsString(retirada("100.00", UUID.randomUUID())));
        for (var caso : java.util.List.of(
                java.util.Map.entry("chaveRequisicao", "null"),
                java.util.Map.entry("valorRetiradoCofre", "-1"),
                java.util.Map.entry("valorRetiradoCofre", "100.001"),
                java.util.Map.entry("saldoInicial", "99"),
                java.util.Map.entry("confirmarTroco", "true"))) {
            var pedido = valido.deepCopy();
            ((com.fasterxml.jackson.databind.node.ObjectNode) pedido).set(caso.getKey(), json.readTree(caso.getValue()));
            int codigo = mvc.perform(post("/financeiro/caixas/{id}/sessoes", caixaA1.getId())
                    .header("Authorization", tokenGerenteA).contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(pedido))).andReturn().getResponse().getStatus();
            assertThat(codigo).isIn(400, 409);
        }
        assertThat(contas.findById(cofreA.getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo("500");
        assertThat(sessoes.count()).isZero();
        assertThat(movimentosFinanceiros.count()).isZero();
    }

    @Test void somenteGerenciaPodeRetirarOuAportar() throws Exception {
        for (var pedido : java.util.List.of(retirada("100.00", UUID.randomUUID()),
                new AberturaCaixaDTO(new BigDecimal("100"), UUID.randomUUID(), false,
                        BigDecimal.ZERO, null, new BigDecimal("100"), "Fundo externo")))
            mvc.perform(post("/financeiro/caixas/{id}/sessoes", caixaA1.getId())
                    .header("Authorization", tokenOperadorA1).contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(pedido))).andExpect(status().isForbidden());
        assertThat(sessoes.count()).isZero();
        assertThat(movimentosFinanceiros.count()).isZero();
    }

    @Test void cofreInativoOutroTenantETipoIncorretoNaoGeramEfeitoParcial() throws Exception {
        var outro = contas.saveAndFlush(new ContaFinanceiraEntity(empresaB, "Cofre B", TipoContaFinanceira.COFRE, new BigDecimal("500")));
        var naoCofre = contas.saveAndFlush(new ContaFinanceiraEntity(empresaA, "Outro", TipoContaFinanceira.OUTROS, new BigDecimal("500")));
        cofreA.situacao(false); contas.saveAndFlush(cofreA);
        for (Long conta : java.util.List.of(cofreA.getId(), outro.getId(), naoCofre.getId())) {
            var pedido = new AberturaCaixaDTO(new BigDecimal("100"), UUID.randomUUID(), false, new BigDecimal("100"), conta, BigDecimal.ZERO, null);
            mvc.perform(post("/financeiro/caixas/{id}/sessoes", caixaA1.getId())
                    .header("Authorization", tokenGerenteA).contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(pedido))).andExpect(status().isConflict());
        }
        assertThat(sessoes.count()).isZero();
        assertThat(movimentosFinanceiros.count()).isZero();
        assertThat(contas.findAll()).allSatisfy(c -> assertThat(c.getSaldoAtual()).isEqualByComparingTo("500"));
    }

    int abrirHttp(Long caixa, AberturaCaixaDTO pedido, String token) throws Exception {
        return mvc.perform(post("/financeiro/caixas/{id}/sessoes", caixa).header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(pedido)))
                .andReturn().getResponse().getStatus();
    }

    @Test void aberturasConcorrentesNoMesmoCaixaConsomemTrocoUmaVez() throws Exception {
        var s = sessaoService.abrir(caixaA1.getId(), new BigDecimal("70"), auth(operadorA1));
        sessaoService.fechar(caixaA1.getId(), s.id(), new FechamentoCaixaDTO(new BigDecimal("70"), null,
                new EntregaCofreDTO(null, BigDecimal.ZERO, new BigDecimal("70"), null, null, false)), auth(operadorA1));
        var pool = Executors.newFixedThreadPool(2); var inicio = new CountDownLatch(1);
        try {
            var a = pool.submit(() -> { inicio.await(); return abrirHttp(caixaA1.getId(), new AberturaCaixaDTO(new BigDecimal("70"), UUID.randomUUID(), true, BigDecimal.ZERO, null, BigDecimal.ZERO, null), tokenOperadorA1); });
            var b = pool.submit(() -> { inicio.await(); return abrirHttp(caixaA1.getId(), new AberturaCaixaDTO(new BigDecimal("70"), UUID.randomUUID(), true, BigDecimal.ZERO, null, BigDecimal.ZERO, null), tokenOperadorA2); });
            inicio.countDown();
            assertThat(java.util.List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS))).containsExactlyInAnyOrder(201,409);
        } finally { pool.shutdownNow(); }
        assertThat(aberturasOrigem.count()).isEqualTo(1);
        assertThat(movimentosFinanceiros.count()).isZero();
    }

    @Test void retryConcorrenteDebitaUmaVez() throws Exception {
        var pedido = retirada("100.00", UUID.randomUUID());
        var pool = Executors.newFixedThreadPool(2); var inicio = new CountDownLatch(1);
        try {
            var a = pool.submit(() -> { inicio.await(); return abrirHttp(caixaA1.getId(), pedido, tokenGerenteA); });
            var b = pool.submit(() -> { inicio.await(); return abrirHttp(caixaA1.getId(), pedido, tokenGerenteA); });
            inicio.countDown();
            assertThat(java.util.List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS))).containsOnly(201);
        } finally { pool.shutdownNow(); }
        assertThat(sessoes.count()).isEqualTo(1);
        assertThat(movimentosFinanceiros.count()).isEqualTo(1);
        assertThat(contas.findById(cofreA.getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo("400");
    }

    @Test void duasRetiradasConcorrentesDeCaixasDiferentesNaoNegativamCofre() throws Exception {
        operadorA2.setPerfil(PerfilUsuario.GERENTE); usuarios.saveAndFlush(operadorA2);
        String tokenOutro = token(operadorA2);
        var pool = Executors.newFixedThreadPool(2); var inicio = new CountDownLatch(1);
        try {
            var a = pool.submit(() -> { inicio.await(); return abrirHttp(caixaA1.getId(), retirada("300", UUID.randomUUID()), tokenGerenteA); });
            var b = pool.submit(() -> { inicio.await(); return abrirHttp(caixaA2.getId(), retirada("300", UUID.randomUUID()), tokenOutro); });
            inicio.countDown();
            assertThat(java.util.List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS))).containsExactlyInAnyOrder(201,409);
        } finally { pool.shutdownNow(); }
        assertThat(sessoes.count()).isEqualTo(1);
        assertThat(movimentosFinanceiros.count()).isEqualTo(1);
        assertThat(contas.findById(cofreA.getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo("200");
    }

    @Test void fechamentoPendenteNaoCreditaCofreMasDisponibilizaTroco() {
        var s = sessaoService.abrir(caixaA1.getId(), new BigDecimal("100"), auth(operadorA1));
        sessaoService.fechar(caixaA1.getId(), s.id(), new FechamentoCaixaDTO(new BigDecimal("100"), null,
                new EntregaCofreDTO(cofreA.getId(), new BigDecimal("30"), new BigDecimal("70"), "Responsável", null, false)), auth(operadorA1));
        assertThat(contas.findById(cofreA.getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo("500");
        assertThat(sessaoService.obterContextoAbertura(caixaA1.getId(), auth(operadorA2)).saldoSugerido()).isEqualByComparingTo("70");
    }

    @Test void transacaoExternaReverteTambemRetiradaDoCofre() {
        assertThatThrownBy(() -> new TransactionTemplate(transactions).executeWithoutResult(tx -> {
            sessaoService.abrir(caixaA1.getId(), retirada("100", UUID.randomUUID()), auth(gerenteA));
            throw new IllegalStateException("Falha na mesma transação");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(contas.findById(cofreA.getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo("500");
        assertThat(sessoes.count()).isZero(); assertThat(movimentosFinanceiros.count()).isZero();
        assertThat(aberturasOrigem.count()).isZero(); assertThat(movimentosCaixa.count()).isZero();
    }

    @Test void devolucaoPosteriorContinuaSuprimentoRealSemReaplicarFundoInicial() {
        var s = sessaoService.abrir(caixaA1.getId(), retirada("100", UUID.randomUUID()), auth(gerenteA));
        var pedido = new CofreService.Devolucao(UUID.randomUUID(), s.id(), new EntregaCofreDTO(cofreA.getId(),
                new BigDecimal("50"), BigDecimal.ZERO, "Responsável", "Reforço de troco", true));
        var primeira = cofreService.devolver(pedido, auth(gerenteA));
        var repetida = cofreService.devolver(pedido, auth(gerenteA));
        assertThat(repetida.id()).isEqualTo(primeira.id());
        assertThat(operacionalService.resumo(s.id(), empresaA.getId()).saldoEsperadoDinheiro()).isEqualByComparingTo("150");
        assertThat(operacionalService.resumo(s.id(), empresaA.getId()).suprimentos()).isEqualByComparingTo("50");
        assertThat(contas.findById(cofreA.getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo("350");
        assertThat(movimentosFinanceiros.count()).isEqualTo(2);
    }

    @Test void naoInventaTrocoRetroativoAposOutraAbertura() {
        var antiga = sessaoService.abrir(caixaA1.getId(), new BigDecimal("100"), auth(operadorA1));
        sessaoService.fechar(caixaA1.getId(), antiga.id(), new BigDecimal("100"), auth(operadorA1));
        sessaoService.abrir(caixaA1.getId(), BigDecimal.ZERO, auth(gerenteA));
        assertThatThrownBy(() -> cofreService.destinar(antiga.id(), new EntregaCofreDTO(null, BigDecimal.ZERO,
                new BigDecimal("100"), null, null, false), auth(gerenteA)))
                .hasMessageContaining("Não é possível atribuir troco retroativamente");
        assertThat(recolhimentosCofre.count()).isZero();
        assertThat(movimentosFinanceiros.count()).isZero();
    }

    @Test void chaveConcorrenteEmCaixasDiferentesNaoPermiteDoisDebitos() throws Exception {
        operadorA2.setPerfil(PerfilUsuario.GERENTE); usuarios.saveAndFlush(operadorA2);
        String tokenOutro = token(operadorA2); var pedido = retirada("100", UUID.randomUUID());
        var pool = Executors.newFixedThreadPool(2); var inicio = new CountDownLatch(1);
        try {
            var a = pool.submit(() -> { inicio.await(); return abrirHttp(caixaA1.getId(), pedido, tokenGerenteA); });
            var b = pool.submit(() -> { inicio.await(); return abrirHttp(caixaA2.getId(), pedido, tokenOutro); });
            inicio.countDown();
            assertThat(java.util.List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS))).containsExactlyInAnyOrder(201,409);
        } finally { pool.shutdownNow(); }
        assertThat(sessoes.count()).isEqualTo(1); assertThat(aberturasOrigem.count()).isEqualTo(1);
        assertThat(movimentosFinanceiros.count()).isEqualTo(1);
        assertThat(contas.findById(cofreA.getId()).orElseThrow().getSaldoAtual()).isEqualByComparingTo("400");
    }
}
