package br.com.novexa.erp.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

public record ContaPagarRequestDTO(
        @NotBlank @Size(max = 200) String descricao,
        Long fornecedorId,
        @Size(max = 100) String categoria,
        LocalDate dataEmissao,
        @NotNull LocalDate dataVencimento,
        @NotNull @DecimalMin("0.01") @Digits(integer = 17, fraction = 2) BigDecimal valor,
        @Size(max = 1000) String observacao) { }
