package br.com.novexa.erp.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record PagamentoMultiorigemContaPagarDTO(
        @NotNull UUID chaveRequisicao, @NotNull LocalDate dataPagamento,
        @NotNull @DecimalMin("0.01") @Digits(integer=17,fraction=2) BigDecimal valorPago,
        @DecimalMin("0.00") @Digits(integer=17,fraction=2) BigDecimal juros,
        @DecimalMin("0.00") @Digits(integer=17,fraction=2) BigDecimal multa,
        @DecimalMin("0.00") @Digits(integer=17,fraction=2) BigDecimal desconto,
        @NotNull @Size(min=1,max=10) List<@NotNull @Valid Origem> origens,
        @DecimalMin("0.01") @Digits(integer=17,fraction=2) BigDecimal principalQuitado) {
    public record Origem(@NotNull @Positive Long contaFinanceiraId,
                         @NotNull @DecimalMin("0.01") @Digits(integer=17,fraction=2) BigDecimal valor) { }
}
