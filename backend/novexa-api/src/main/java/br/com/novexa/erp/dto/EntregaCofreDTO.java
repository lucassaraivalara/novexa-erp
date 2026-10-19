package br.com.novexa.erp.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public record EntregaCofreDTO(@Positive Long contaCofreId,
        @NotNull @DecimalMin("0.00") @Digits(integer=12,fraction=2) BigDecimal valor,
        @NotNull @DecimalMin("0.00") @Digits(integer=12,fraction=2) BigDecimal valorTroco,
        @Size(max=150) String responsavel, @Size(max=500) String observacao, boolean confirmarEntrega) { }
