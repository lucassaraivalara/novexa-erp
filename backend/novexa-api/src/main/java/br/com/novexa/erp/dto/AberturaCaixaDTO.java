package br.com.novexa.erp.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.UUID;

public record AberturaCaixaDTO(
        @NotNull @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal saldoInicial,
        UUID chaveRequisicao,
        Boolean confirmarTroco,
        @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal valorRetiradoCofre,
        Long contaCofreId,
        @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal valorAporteExterno,
        @Size(max = 500) String observacaoAporte
) {
    public AberturaCaixaDTO(BigDecimal saldoInicial) {
        this(saldoInicial, null, null, null, null, null, null);
    }
}
