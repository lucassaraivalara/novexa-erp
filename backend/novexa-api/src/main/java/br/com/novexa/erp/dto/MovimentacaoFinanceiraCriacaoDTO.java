package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.TipoMovimentacaoFinanceira;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

public record MovimentacaoFinanceiraCriacaoDTO(
        @NotNull Long contaFinanceiraId,
        @NotNull TipoMovimentacaoFinanceira tipo,
        @NotBlank @Size(max = 200) String descricao,
        @NotNull @DecimalMin("0.01") @Digits(integer = 17, fraction = 2) BigDecimal valor,
        @NotNull LocalDate dataMovimento,
        @Size(max = 1000) String observacao) { }
