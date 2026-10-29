package br.com.novexa.erp.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

public record PagamentoContaPagarRequestDTO(
        @NotNull Long contaFinanceiraId,
        @NotNull LocalDate dataPagamento,
        @NotNull @DecimalMin("0.01") @Digits(integer = 17, fraction = 2) BigDecimal valorPago,
        @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal juros,
        @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal multa,
        @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal desconto) { }
