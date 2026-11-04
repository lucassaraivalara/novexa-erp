package br.com.novexa.erp.dto;
import java.math.BigDecimal;
public record OrigemPagamentoContaPagarDTO(Long pagamentoId, Long movimentoId, Long contaFinanceiraId,
        String contaFinanceiraNome, BigDecimal valor, boolean estornada) { }
