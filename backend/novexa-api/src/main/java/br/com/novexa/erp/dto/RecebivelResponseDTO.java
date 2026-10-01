package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record RecebivelResponseDTO(Long id, Long vendaId, Long pagamentoId, TipoFormaPagamento tipo,
        int numeroParcela, int totalParcelas, BigDecimal valorBruto, BigDecimal valorLiquidoPrevisto,
        LocalDateTime dataVenda, LocalDate dataPrevistaRecebimento, StatusRecebivel status, String configuracaoNomeExibicao) {
    public static RecebivelResponseDTO de(RecebivelEntity r) {
        return new RecebivelResponseDTO(r.getId(), r.getVenda().getId(), r.getPagamento().getId(), r.getTipo(),
                r.getNumeroParcela(), r.getTotalParcelas(), r.getValorBruto(), r.getValorLiquidoPrevisto(),
                r.getDataVenda(), r.getDataPrevistaRecebimento(), r.getStatus(), r.getConfiguracaoNomeExibicao());
    }
}
