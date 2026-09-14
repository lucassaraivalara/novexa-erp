package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.FormaPagamento;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.UUID;

public record FaturamentoVendaDTO(
        @NotNull UUID chaveRequisicao,
        @NotNull @DecimalMin("0.01") @Digits(integer = 12, fraction = 2) BigDecimal totalEsperado,
        @NotNull FormaPagamento formaPagamento,
        @NotNull @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal valorRecebido
) { }
