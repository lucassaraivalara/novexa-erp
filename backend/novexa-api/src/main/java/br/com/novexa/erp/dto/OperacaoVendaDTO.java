package br.com.novexa.erp.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public final class OperacaoVendaDTO {
    private OperacaoVendaDTO() { }

    public record Item(@NotNull @Positive Long produtoId,
                       @NotNull @DecimalMin("0.001") @Digits(integer = 9, fraction = 3) BigDecimal quantidade) { }
    public record Quantidade(
            @NotNull @DecimalMin("0.001") @Digits(integer = 9, fraction = 3) BigDecimal quantidade) { }
    public record Desconto(
            @NotNull @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal desconto) { }
    public record Cliente(@NotNull @Positive Long clienteId) { }
}
