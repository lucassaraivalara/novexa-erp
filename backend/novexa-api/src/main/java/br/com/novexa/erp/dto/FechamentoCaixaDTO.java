package br.com.novexa.erp.dto;

import jakarta.validation.constraints.*;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.util.List;

public record FechamentoCaixaDTO(
        @NotNull @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal saldoFinal,
        @Valid Conferencia conferencia) {
    public FechamentoCaixaDTO(BigDecimal saldoFinal) { this(saldoFinal, null); }

    public record Conferencia(@NotNull List<@NotNull @Valid Forma> formas,
                              @Size(max = 500) String observacao) { }
    public record Forma(@NotNull @Positive Long formaPagamentoId,
                        @NotNull @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal valorInformado) { }
}
