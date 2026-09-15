package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.TipoMovimentacaoCaixa;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.UUID;

public record MovimentacaoCaixaRequestDTO(@NotNull UUID chaveRequisicao,
        @NotNull TipoMovimentacaoCaixa tipo,
        @NotNull @DecimalMin("0.01") @Digits(integer = 12, fraction = 2) BigDecimal valor,
        @Size(max = 500) String observacao) { }
