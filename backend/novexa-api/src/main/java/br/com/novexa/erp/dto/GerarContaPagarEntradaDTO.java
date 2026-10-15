package br.com.novexa.erp.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record GerarContaPagarEntradaDTO(
        @NotNull UUID chaveRequisicao,
        @NotBlank @Size(max = 200) String descricao,
        @NotNull @DecimalMin("0.01") @Digits(integer = 17, fraction = 2) BigDecimal valor,
        @NotNull LocalDate dataVencimento) { }
