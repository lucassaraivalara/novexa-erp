package br.com.novexa.erp.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record TransferenciaFinanceiraCriacaoDTO(
        @NotNull UUID chaveRequisicao,
        @NotNull Long contaOrigemId,
        @NotNull Long contaDestinoId,
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 17, fraction = 2) BigDecimal valor,
        @NotNull LocalDate dataMovimento,
        @Size(max = 1000) String observacao) { }
