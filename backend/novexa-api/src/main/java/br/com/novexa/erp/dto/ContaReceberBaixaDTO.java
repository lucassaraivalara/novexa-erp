package br.com.novexa.erp.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record ContaReceberBaixaDTO(
        @NotNull @Positive Long contaFinanceiraId,
        @NotNull @DecimalMin("0.01") @Digits(integer = 17, fraction = 2) BigDecimal valor,
        @NotNull LocalDate dataRecebimento, @Size(max = 1000) String observacao,
        @NotNull UUID chaveRequisicao) { }
