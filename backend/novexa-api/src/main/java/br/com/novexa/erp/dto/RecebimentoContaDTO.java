package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.FormaPagamento;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Consulta dos registros existentes; não representa outra fonte de saldo. */
public record RecebimentoContaDTO(Long id, Long vendaId, Long recebivelId, FormaPagamento formaPagamento,
        String configuracaoNome, Long contaDestinoId, String contaDestinoNome,
        BigDecimal valorBruto, BigDecimal valorTaxas, BigDecimal valorLiquidoPrevisto,
        LocalDateTime dataHora, LocalDate dataPrevista, String status,
        BigDecimal valorLiquidado, LocalDateTime dataLiquidacao, Long movimentacaoFinanceiraId) { }
