package br.com.novexa.erp.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public record PagamentoVendaRequestDTO(
        @NotNull @Positive Long configuracaoFormaPagamentoId,
        @NotNull @DecimalMin("0.01") @Digits(integer = 12, fraction = 2) BigDecimal valor,
        @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal valorRecebido
) { }
