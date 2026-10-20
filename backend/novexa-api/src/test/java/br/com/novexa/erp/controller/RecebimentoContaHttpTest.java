package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class RecebimentoContaHttpTest extends RecebivelHttpTest {
    private static final String URL = "/financeiro/recebimentos-contas";

    org.springframework.test.web.servlet.ResultActions consulta(String query) throws Exception {
        return fluxo.mvc.perform(get(URL + query).header("Authorization", fluxo.authorization));
    }

    ConfiguracaoFormaPagamentoEmpresaEntity cartao() {
        var conta = fluxo.contasFinanceiras.saveAndFlush(new ContaFinanceiraEntity(fluxo.empresa,
                "Gateway teste", TipoContaFinanceira.CARTEIRA_DIGITAL, BigDecimal.ZERO));
        var config = new ConfiguracaoFormaPagamentoEmpresaEntity(fluxo.empresa,
                fluxo.catalogo.findById(4L).orElseThrow(), "Credito gateway", true, conta);
        config.atualizarCondicoesCartao(new BigDecimal("3"), new BigDecimal("0.50"), 2);
        return fluxo.configuracoes.saveAndFlush(config);
    }

    @Test void previstoLiquidoNaoCreditaSaldoELiquidacaoRepetidaNaoDuplicaResumo() throws Exception {
        var config = cartao();
        var p = pedido("CARTAO_CREDITO"); p.put("configuracaoFormaPagamentoId", config.getId());
        long venda = enviar(p); assertThat(enviar(p)).isEqualTo(venda);
        long recebivel = recebiveis.findAll().getFirst().getId();
        consulta("?contaId=" + config.getContaFinanceiraDestino().getId())
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].status").value("A_LIQUIDAR"))
                .andExpect(jsonPath("$.items[0].valorBruto").value(20))
                .andExpect(jsonPath("$.items[0].valorTaxas").value(1.1))
                .andExpect(jsonPath("$.items[0].valorLiquidoPrevisto").value(18.9))
                .andExpect(jsonPath("$.items[0].dataPrevista").isNotEmpty())
                .andExpect(jsonPath("$.items[0].configuracaoNome").value("Credito gateway"));
        consulta("/resumo").andExpect(jsonPath("$[0].aLiquidar").value(18.9))
                .andExpect(jsonPath("$[0].liquidado").value(0));
        assertThat(fluxo.contasFinanceiras.findById(config.getContaFinanceiraDestino().getId()).orElseThrow()
                .getSaldoAtual()).isZero();
        assertThat(movimentosFinanceiros.count()).isZero();
        for (int i = 0; i < 2; i++) fluxo.mvc.perform(post("/financeiro/recebiveis/" + recebivel + "/liquidar")
                .header("Authorization", fluxo.authorization)).andExpect(status().isOk());
        consulta("?status=LIQUIDADO").andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].valorLiquidado").value(18.9))
                .andExpect(jsonPath("$.items[0].movimentacaoFinanceiraId").isNumber());
        consulta("/resumo").andExpect(jsonPath("$[0].aLiquidar").value(0))
                .andExpect(jsonPath("$[0].liquidado").value(18.9));
        assertThat(movimentosFinanceiros.count()).isEqualTo(1);
        cancelar(venda);
        consulta("").andExpect(jsonPath("$.totalItems").value(0));
        consulta("/resumo").andExpect(jsonPath("$").isEmpty());
        assertThat(fluxo.contasFinanceiras.findById(config.getContaFinanceiraDestino().getId()).orElseThrow()
                .getSaldoAtual()).isZero();
    }

    @Test void pixSoFicaLiquidadoAposConfirmacaoESemTaxaOuDataInventada() throws Exception {
        long venda = enviar(pedido("PIX"));
        long pagamento = pagamentos.findAll().getFirst().getId();
        consulta("?status=A_LIQUIDAR").andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].valorLiquidoPrevisto").value(20))
                .andExpect(jsonPath("$.items[0].valorTaxas").doesNotExist())
                .andExpect(jsonPath("$.items[0].dataPrevista").doesNotExist());
        for (int i = 0; i < 2; i++) fluxo.mvc.perform(post("/financeiro/pagamentos/" + pagamento + "/confirmar-recebimento")
                .header("Authorization", fluxo.authorization)).andExpect(status().isOk());
        consulta("?status=LIQUIDADO").andExpect(jsonPath("$.items[0].valorLiquidado").value(20));
        consulta("/resumo").andExpect(jsonPath("$[0].aLiquidar").value(0))
                .andExpect(jsonPath("$[0].liquidado").value(20));
        cancelar(venda);
        consulta("/resumo").andExpect(jsonPath("$").isEmpty());
    }

    @Test void fechamentoNaoLiquidaEAlterarConfiguracaoNaoRedirecionaHistorico() throws Exception {
        var config = cartao();
        long destinoOriginal = config.getContaFinanceiraDestino().getId();
        var p = pedido("CARTAO_CREDITO"); p.put("configuracaoFormaPagamentoId", config.getId());
        enviar(p);
        var outroDestino = fluxo.contasFinanceiras.saveAndFlush(new ContaFinanceiraEntity(fluxo.empresa,
                "Outro destino", TipoContaFinanceira.CARTEIRA_DIGITAL, BigDecimal.ZERO));
        config.atualizar("Configuracao alterada", true, outroDestino);
        config.atualizarCondicoesCartao(BigDecimal.TEN, BigDecimal.ZERO, 15);
        fluxo.configuracoes.saveAndFlush(config);
        var sessao = fluxo.sessoes.findAll().getFirst();
        sessao.fechar(fluxo.operador, BigDecimal.ZERO); fluxo.sessoes.saveAndFlush(sessao);
        consulta("?contaId=" + destinoOriginal).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].configuracaoNome").value("Credito gateway"))
                .andExpect(jsonPath("$.items[0].valorLiquidoPrevisto").value(18.9))
                .andExpect(jsonPath("$.items[0].status").value("A_LIQUIDAR"));
        consulta("?contaId=" + outroDestino.getId()).andExpect(jsonPath("$.totalItems").value(0));
        assertThat(movimentosFinanceiros.count()).isZero();
    }

    @Test void semDestinoHistoricoFicaIdentificadoSemRecriarVinculo() throws Exception {
        enviar(pedido("CARTAO_CREDITO"));
        consulta("?semDestino=true").andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].contaDestinoId").doesNotExist())
                .andExpect(jsonPath("$.items[0].status").value("A_LIQUIDAR"));
        consulta("/resumo").andExpect(jsonPath("$[0].contaDestinoId").doesNotExist())
                .andExpect(jsonPath("$[0].aLiquidar").value(20));
    }

    @Test void liquidoHistoricoAusenteNaoEInferidoDoBrutoNemOcultadoNoResumo() throws Exception {
        var config = cartao();
        var p = pedido("CARTAO_CREDITO"); p.put("configuracaoFormaPagamentoId", config.getId());
        enviar(p);
        fluxo.jdbc.update("""
            update recebiveis set valor_liquido_previsto=null, valor_taxas_previsto=null,
                data_prevista_recebimento=null, taxa_percentual_snapshot=null,
                taxa_fixa_snapshot=null, prazo_recebimento_dias_snapshot=null
            """);
        fluxo.jdbc.update("update pagamentos set taxa_percentual_snapshot=null, taxa_fixa_snapshot=null, prazo_recebimento_dias_snapshot=null");
        consulta("").andExpect(status().isOk()).andExpect(jsonPath("$.items[0].valorBruto").value(20))
                .andExpect(jsonPath("$.items[0].valorLiquidoPrevisto").doesNotExist());
        consulta("/resumo").andExpect(status().isOk())
                .andExpect(jsonPath("$[0].aLiquidar").value(0))
                .andExpect(jsonPath("$[0].quantidadeALiquidar").value(1))
                .andExpect(jsonPath("$[0].quantidadeSemValor").value(1));
        assertThat(movimentosFinanceiros.count()).isZero();
    }

    @Test void paginaOrdenaFiltraValidaParametrosEExcluiDinheiro() throws Exception {
        consulta("").andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(0));
        enviar(pedido("DINHEIRO")); enviar(pedido("PIX")); enviar(pedido("CARTAO_CREDITO"));
        consulta("?page=0&size=1&sort=id,asc&status= ")
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.items[0].formaPagamento").value("PIX"));
        consulta("?page=1&size=1&sort=id,asc&status=A_LIQUIDAR")
                .andExpect(jsonPath("$.items[0].formaPagamento").value("CARTAO_CREDITO"));
        consulta("?sort=id,desc&status=").andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].formaPagamento").value("CARTAO_CREDITO"));
        consulta("?status=LIQUIDADO").andExpect(jsonPath("$.items").isEmpty());
        consulta("?status=INVENTADO").andExpect(status().isBadRequest());
        consulta("?sort=empresaId,asc").andExpect(status().isBadRequest());
        consulta("?page=-1").andExpect(status().isBadRequest());
        consulta("?contaId=1&semDestino=true").andExpect(status().isBadRequest());
        fluxo.mvc.perform(get(URL)).andExpect(status().isUnauthorized());
    }

    @Test void empresaDoJwtIsolaResumoDetalheEConta() throws Exception {
        var config = cartao();
        var p = pedido("CARTAO_CREDITO"); p.put("configuracaoFormaPagamentoId", config.getId());
        enviar(p);
        fluxo.authorization = br.com.novexa.erp.support.AutenticacaoTeste.token(
                fluxo.usuarios, fluxo.jwt, fluxo.outra, PerfilUsuario.USUARIO, "52998224725");
        consulta("").andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(0));
        consulta("/resumo").andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
        consulta("?contaId=" + config.getContaFinanceiraDestino().getId()).andExpect(status().isNotFound());
    }
}
