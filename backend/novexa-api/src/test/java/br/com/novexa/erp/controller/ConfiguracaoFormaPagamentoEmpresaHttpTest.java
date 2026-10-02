package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.service.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:config-formas;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa", "spring.datasource.password=", "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false",
        "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=60000"
})
@AutoConfigureMockMvc
@Transactional
@Sql("/formas-pagamento-fixture.sql")
class ConfiguracaoFormaPagamentoEmpresaHttpTest {
    @Autowired UsuarioRepository usuarios;
    private static final String URL = "/financeiro/configuracoes-formas-pagamento";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired EmpresaRepository empresas;
    @Autowired ContaFinanceiraRepository contas;
    @Autowired ConfiguracaoFormaPagamentoEmpresaRepository configuracoes;
    @Autowired MovimentacaoFinanceiraRepository movimentos;
    @Autowired FormaPagamentoRepository formas;
    @Autowired JwtService jwt;
    EmpresaEntity empresa, outra;
    ContaFinanceiraEntity banco, carteira, externa, inativa;
    String token, tokenOutro;
    @ParameterizedTest @ValueSource(longs = {3, 4})
    void cartaoAceitaCondicoesIndependentesEPayloadAntigo(long forma) throws Exception {
        var p = pedido(forma, "Com taxas", banco.getId());
        p.put("taxaPercentual", "3.2"); p.put("taxaFixa", "0.50"); p.put("prazoRecebimentoDias", 30);
        long id = id(criar(token, p).andExpect(status().isCreated()).andExpect(jsonPath("$.taxaPercentual").value(3.2))
                .andExpect(jsonPath("$.taxaFixa").value(0.5)).andExpect(jsonPath("$.prazoRecebimentoDias").value(30)));
        atualizar(token, id, pedido(forma, "Com taxas", banco.getId())).andExpect(status().isOk())
                .andExpect(jsonPath("$.taxaPercentual").value(3.2)).andExpect(jsonPath("$.prazoRecebimentoDias").value(30));
        criar(token, pedido(forma, "Sem taxas", banco.getId())).andExpect(status().isCreated())
                .andExpect(jsonPath("$.taxaPercentual").value(0)).andExpect(jsonPath("$.prazoRecebimentoDias").value(0));
    }
    @ParameterizedTest @ValueSource(strings = {"taxaPercentual:-1", "taxaPercentual:100.01", "taxaPercentual:1.00001",
            "taxaFixa:-0.01", "taxaFixa:0.001", "prazoRecebimentoDias:-1", "prazoRecebimentoDias:1.5"})
    void condicoesInvalidasNaoCriamConfiguracao(String invalido) throws Exception {
        var partes = invalido.split(":"); var p = pedido(4, "Invalida", banco.getId()); p.put(partes[0], partes[1]);
        criar(token, p).andExpect(status().isBadRequest()); assertThat(configuracoes.count()).isZero();
    }
    @ParameterizedTest @ValueSource(longs = {1, 2, 5, 6})
    void outrosTiposNaoAceitamCondicoesDeCartao(long forma) throws Exception {
        var p = pedido(forma, "Outra", forma == 2 || forma == 6 ? banco.getId() : null);
        p.put("taxaPercentual", 0); criar(token, p).andExpect(status().isBadRequest());
        assertThat(configuracoes.count()).isZero();
    }
    @Test void prazoDecimalNumericoNaoPodeSerTruncado() throws Exception {
        var p = pedido(4, "Prazo fracionado", banco.getId()); p.put("prazoRecebimentoDias", new BigDecimal("1.5"));
        criar(token, p).andExpect(status().isBadRequest()); assertThat(configuracoes.count()).isZero();
    }

    @BeforeEach void preparar() {
        empresa = empresa(); outra = empresa();
        token = br.com.novexa.erp.support.AutenticacaoTeste.token(usuarios, jwt, empresa, PerfilUsuario.USUARIO, "02360684663");
        tokenOutro = br.com.novexa.erp.support.AutenticacaoTeste.token(usuarios, jwt, outra, PerfilUsuario.ADMIN, "11144477735");
        banco = conta(empresa, TipoContaFinanceira.BANCO);
        carteira = conta(empresa, TipoContaFinanceira.CARTEIRA_DIGITAL);
        externa = conta(outra, TipoContaFinanceira.BANCO);
        inativa = conta(empresa, TipoContaFinanceira.BANCO); inativa.situacao(false); contas.saveAndFlush(inativa);
    }

    @Test void dinheiroSemDestinoETenantDerivadoDoJwt() throws Exception {
        var p = pedido(1, "Dinheiro", null); p.put("empresaId", outra.getId()); p.put("tipo", "PIX");
        long id = id(criar(token, p).andExpect(status().isCreated())
                .andExpect(jsonPath("$.tipo").value("DINHEIRO"))
                .andExpect(jsonPath("$.contaFinanceiraDestino").doesNotExist())
                .andExpect(jsonPath("$.dataCriacao").isNotEmpty()).andExpect(jsonPath("$.dataAtualizacao").isNotEmpty()));
        assertThat(configuracoes.findById(id).orElseThrow().getEmpresa().getId()).isEqualTo(empresa.getId());
        assertThat(movimentos.count()).isZero();
    }

    @ParameterizedTest @ValueSource(longs = {1, 5})
    void tiposSemDestinoRejeitamConta(long forma) throws Exception {
        criar(token, pedido(forma, "Forma", banco.getId())).andExpect(status().isBadRequest());
        assertThat(configuracoes.count()).isZero();
    }

    @ParameterizedTest @ValueSource(longs = {2, 3, 4, 6})
    void pixETransferenciaExigemBancoOuCarteira(long forma) throws Exception {
        criar(token, pedido(forma, "Sem destino", null)).andExpect(status().isBadRequest());
        criar(token, pedido(forma, "Banco", banco.getId())).andExpect(status().isCreated())
                .andExpect(jsonPath("$.contaFinanceiraDestino.tipo").value("BANCO"));
        criar(token, pedido(forma, "Carteira", carteira.getId())).andExpect(status().isCreated())
                .andExpect(jsonPath("$.contaFinanceiraDestino.tipo").value("CARTEIRA_DIGITAL"));
        assertThat(banco.getSaldoAtual()).isEqualByComparingTo("100");
        assertThat(carteira.getSaldoAtual()).isEqualByComparingTo("100");
        assertThat(movimentos.count()).isZero();
    }

    @ParameterizedTest @ValueSource(strings = {"CAIXA", "ADQUIRENTE", "COFRE", "OUTROS"})
    void rejeitaTiposDeContaNaoPermitidos(String tipo) throws Exception {
        var destino = conta(empresa, TipoContaFinanceira.valueOf(tipo));
        for (long forma : new long[]{2, 3, 4, 6})
            criar(token, pedido(forma, "Inválida", destino.getId())).andExpect(status().isBadRequest());
    }

    @ParameterizedTest @ValueSource(longs = {2, 3, 4, 5})
    void permiteMultiplasConfiguracoesDaMesmaForma(long forma) throws Exception {
        for (String nome : List.of("Stone", "Cielo", "Rede"))
            criar(token, pedido(forma, nome, forma == 5 ? null : banco.getId())).andExpect(status().isCreated());
        assertThat(configuracoes.listar(empresa.getId(), null)).hasSize(3);
        assertThat(movimentos.count()).isZero();
    }

    @Test void nomeUnicoNormalizadoSomenteNaEmpresaInclusiveUpdate() throws Exception {
        criar(token, pedido(2, "PIX Sicredi", banco.getId())).andExpect(status().isCreated());
        criar(token, pedido(2, " pix sicredi ", carteira.getId())).andExpect(status().isConflict());
        long id = id(criar(token, pedido(2, "Outra", carteira.getId())).andExpect(status().isCreated()));
        atualizar(token, id, pedido(2, "PIX SICREDI", carteira.getId())).andExpect(status().isConflict());
        criar(tokenOutro, pedido(2, " pix sicredi ", externa.getId())).andExpect(status().isCreated())
                .andExpect(jsonPath("$.nomeExibicao").value("pix sicredi"));
        assertThat(configuracoes.listar(outra.getId(), null)).hasSize(1);
    }

    @Test void crossTenantNaoAcessaNemAlteraNemVincula() throws Exception {
        for (long forma : new long[]{2, 3, 4, 6})
            criar(token, pedido(forma, "Externa", externa.getId())).andExpect(status().isNotFound());
        long id = id(criar(token, pedido(2, "Minha", banco.getId())).andExpect(status().isCreated()));
        mvc.perform(get(URL + "/" + id).header("Authorization", tokenOutro)).andExpect(status().isNotFound());
        atualizar(tokenOutro, id, pedido(2, "Tomada", externa.getId())).andExpect(status().isNotFound());
        atualizar(token, id, pedido(2, "Minha", externa.getId())).andExpect(status().isNotFound());
        mvc.perform(get(URL).header("Authorization", tokenOutro)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        assertThat(configuracoes.findById(id).orElseThrow().getNomeExibicao()).isEqualTo("Minha");
    }

    @Test void inativaRejeitadaAoCriarETrocarMasPreservadaNaEdicaoDescritiva() throws Exception {
        criar(token, pedido(2, "Inválida", inativa.getId())).andExpect(status().isConflict());
        long id = id(criar(token, pedido(2, "PIX", banco.getId())).andExpect(status().isCreated()));
        atualizar(token, id, pedido(2, "PIX", inativa.getId())).andExpect(status().isConflict());
        banco.situacao(false); contas.saveAndFlush(banco);
        atualizar(token, id, pedido(2, "PIX renomeado", banco.getId())).andExpect(status().isOk())
                .andExpect(jsonPath("$.contaFinanceiraDestino.ativo").value(false))
                .andExpect(jsonPath("$.contaFinanceiraDestino.id").value(banco.getId()));
        mvc.perform(get(URL + "/" + id).header("Authorization", token)).andExpect(status().isOk());
        atualizar(token, id, pedido(2, "PIX carteira", carteira.getId())).andExpect(status().isOk())
                .andExpect(jsonPath("$.contaFinanceiraDestino.id").value(carteira.getId()));
    }

    @Test void formaImutavelMesmoQuandoNovoIdTemMesmoTipo() throws Exception {
        long id = id(criar(token, pedido(2, "PIX", banco.getId())).andExpect(status().isCreated()));
        var outraPix = formas.saveAndFlush(new FormaPagamentoEntity("PIX global legado", TipoFormaPagamento.PIX, true));
        for (long forma : new long[]{6, outraPix.getId()})
            atualizar(token, id, pedido(forma, "PIX", banco.getId())).andExpect(status().isConflict());
    }

    @Test void inativacaoPreservaRegistroEFiltros() throws Exception {
        long id = id(criar(token, pedido(1, "Dinheiro", null)).andExpect(status().isCreated()));
        var p = pedido(1, "Dinheiro", null); p.put("ativo", false);
        atualizar(token, id, p).andExpect(status().isOk()).andExpect(jsonPath("$.ativo").value(false));
        mvc.perform(get(URL + "/" + id).header("Authorization", token)).andExpect(status().isOk());
        for (String filtro : List.of("ativas", "inativas", "todas"))
            mvc.perform(get(URL).param("situacao", filtro).header("Authorization", token))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(filtro.equals("ativas") ? 0 : 1));
        mvc.perform(get(URL).param("situacao", "invalida").header("Authorization", token)).andExpect(status().isBadRequest());
        assertThat(configuracoes.count()).isEqualTo(1);
    }

    @Test void edicaoDeSituacaoPreservaDestinoInativado() throws Exception {
        long id = id(criar(token, pedido(2, "PIX", banco.getId())).andExpect(status().isCreated()));
        banco.situacao(false); contas.saveAndFlush(banco);
        var p = pedido(2, "PIX", banco.getId()); p.put("ativo", false);
        atualizar(token, id, p).andExpect(status().isOk());
        p.put("ativo", true);
        atualizar(token, id, p).andExpect(status().isOk())
                .andExpect(jsonPath("$.ativo").value(true))
                .andExpect(jsonPath("$.contaFinanceiraDestino.id").value(banco.getId()))
                .andExpect(jsonPath("$.contaFinanceiraDestino.ativo").value(false));
    }

    @Test void nomeNormalizadoPersistidoEAtualizadoSemAutoridadeDoPayload() throws Exception {
        var p = pedido(1, "  Dinheiro Loja  ", null); p.put("nomeNormalizado", "adulterado");
        long id = id(criar(token, p).andExpect(status().isCreated()));
        assertThat(configuracoes.findById(id).orElseThrow().getNomeNormalizado()).isEqualTo("dinheiro loja");
        atualizar(token, id, pedido(1, "  DINHEIRO MATRIZ  ", null)).andExpect(status().isOk());
        assertThat(configuracoes.findById(id).orElseThrow().getNomeNormalizado()).isEqualTo("dinheiro matriz");
        criar(token, pedido(1, "dinheiro matriz", null)).andExpect(status().isConflict());
    }

    @Test void validaCamposFormaGlobalEAutenticacao() throws Exception {
        criar(token, pedido(999, "Inexistente", null)).andExpect(status().isNotFound());
        criar(token, pedido(1, " ", null)).andExpect(status().isBadRequest());
        criar(token, pedido(1, "x".repeat(151), null)).andExpect(status().isBadRequest());
        var forma = formas.findById(1L).orElseThrow(); forma.atualizar("Dinheiro", false); formas.saveAndFlush(forma);
        criar(token, pedido(1, "Inativa", null)).andExpect(status().isConflict());
        mvc.perform(get(URL)).andExpect(status().isUnauthorized());
        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isUnauthorized());
    }

    private Map<String, Object> pedido(long forma, String nome, Long destino) {
        var p = new HashMap<String, Object>(); p.put("formaPagamentoId", forma); p.put("nomeExibicao", nome);
        p.put("contaFinanceiraDestinoId", destino); return p;
    }
    private ResultActions criar(String auth, Map<String, Object> p) throws Exception {
        return mvc.perform(post(URL).header("Authorization", auth).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(p)));
    }
    private ResultActions atualizar(String auth, long id, Map<String, Object> p) throws Exception {
        return mvc.perform(put(URL + "/" + id).header("Authorization", auth).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(p)));
    }
    private long id(ResultActions r) throws Exception { return json.readTree(r.andReturn().getResponse().getContentAsString()).get("id").asLong(); }
    private EmpresaEntity empresa() {
        var e = new EmpresaEntity(); e.setRazaoSocial("Empresa"); e.setAtivo(true); return empresas.saveAndFlush(e);
    }
    private ContaFinanceiraEntity conta(EmpresaEntity e, TipoContaFinanceira tipo) {
        return contas.saveAndFlush(new ContaFinanceiraEntity(e, tipo.name(), tipo, new BigDecimal("100")));
    }
}
