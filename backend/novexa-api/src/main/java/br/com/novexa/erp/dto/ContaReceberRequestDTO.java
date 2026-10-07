package br.com.novexa.erp.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

public record ContaReceberRequestDTO(
        @NotNull @Positive Long clienteId,
        @NotBlank @Size(max = 200) String descricao,
        @NotNull @DecimalMin("0.01") @Digits(integer = 17, fraction = 2) BigDecimal valorOriginal,
        LocalDate dataEmissao, @NotNull LocalDate dataVencimento,
        @Min(1) Integer numeroParcela, @Min(1) Integer totalParcelas,
        @Size(max = 1000) String observacao) { }
