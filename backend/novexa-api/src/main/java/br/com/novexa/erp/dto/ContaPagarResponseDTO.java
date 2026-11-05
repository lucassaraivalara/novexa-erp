package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.*;
import java.math.BigDecimal;
import java.time.LocalDate;

public record ContaPagarResponseDTO(Long id, String descricao, String documento, Long fornecedorId, String fornecedorNome,
        String categoria, LocalDate dataEmissao, LocalDate dataVencimento, BigDecimal valor,
        StatusContaPagar status, LocalDate dataPagamento, BigDecimal valorPago, String observacao,
        Long movimentacaoFinanceiraId, Long entradaMercadoriaId, OrigemContaPagarEntrada origemVinculoEntrada,
        BigDecimal juros, BigDecimal multa, BigDecimal desconto, Long pagamentoAtualId,
        BigDecimal principalQuitado, BigDecimal saldoPendente) {
    public static ContaPagarResponseDTO de(ContaPagarEntity conta) {
        var fornecedor = conta.getFornecedor();
        var pagamento = conta.getPagamentoAtual();
        return new ContaPagarResponseDTO(conta.getId(), conta.getDescricao(), conta.getDocumento(),
                fornecedor == null ? null : fornecedor.getId(),
                fornecedor == null ? null : fornecedor.getRazaoSocial(),
                conta.getCategoria(), conta.getDataEmissao(), conta.getDataVencimento(),
                conta.getValor(), conta.getStatus(), conta.getDataPagamento(), conta.getValorPago(),
                conta.getObservacao(), conta.getMovimentacaoFinanceira() == null
                        ? null : conta.getMovimentacaoFinanceira().getId(),
                conta.getEntradaMercadoria() == null ? null : conta.getEntradaMercadoria().getId(),
                conta.getEntradaMercadoria() == null ? null : conta.getEntradaMercadoria().getOrigemContaPagar(),
                pagamento != null ? pagamento.getJuros() : conta.getMovimentacaoFinanceira() == null ? null : conta.getMovimentacaoFinanceira().getContaPagarJuros(),
                pagamento != null ? pagamento.getMulta() : conta.getMovimentacaoFinanceira() == null ? null : conta.getMovimentacaoFinanceira().getContaPagarMulta(),
                pagamento != null ? pagamento.getDesconto() : conta.getMovimentacaoFinanceira() == null ? null : conta.getMovimentacaoFinanceira().getContaPagarDesconto(),
                pagamento == null ? null : pagamento.getId(), conta.getPrincipalQuitado(), conta.getSaldoPendente());
    }
}
