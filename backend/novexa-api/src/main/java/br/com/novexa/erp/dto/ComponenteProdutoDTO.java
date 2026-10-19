package br.com.novexa.erp.dto;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
public record ComponenteProdutoDTO(@NotNull @Positive Long produtoId,
        @NotNull @DecimalMin("0.001") @Digits(integer=12,fraction=3) BigDecimal quantidade,
        @NotNull @DecimalMin("0.000001") @Digits(integer=12,fraction=6) BigDecimal fator,
        @NotBlank @Size(max=10) String unidade) { }
