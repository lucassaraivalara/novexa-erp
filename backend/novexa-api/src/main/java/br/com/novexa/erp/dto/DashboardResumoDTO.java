package br.com.novexa.erp.dto;

import java.math.BigDecimal;
import java.util.List;

public record DashboardResumoDTO(
        BigDecimal faturamentoHoje,
        long quantidadeVendasHoje,
        BigDecimal ticketMedioHoje,
        long quantidadeProdutosEstoqueBaixo,
        long quantidadeClientesAtivos,
        List<SessaoCaixaAberta> sessoesCaixaAbertas) {

    public record SessaoCaixaAberta(
            Long sessaoId,
            Long caixaId,
            String descricaoCaixa,
            BigDecimal saldoInicial,
            BigDecimal saldoEsperadoDinheiro) {
    }
}
