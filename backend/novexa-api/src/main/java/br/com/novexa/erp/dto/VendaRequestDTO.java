package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.FormaPagamento;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record VendaRequestDTO(
        @NotNull UUID chaveRequisicao,
        @NotEmpty @Size(max = 200) List<@NotNull @Valid Item> itens,
        @Positive Long clienteId,
        @NotNull @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal desconto,
        @NotNull @DecimalMin("0.01") @Digits(integer = 12, fraction = 2) BigDecimal totalEsperado,
        @NotNull FormaPagamento formaPagamento,
        @NotNull @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal valorRecebido,
        @Size(max = 500) String entrega,
        @Size(max = 2000) String observacoes
) {
    public record Item(
            @NotNull @Positive Long produtoId,
            @NotNull @DecimalMin("0.001") @Digits(integer = 9, fraction = 3) BigDecimal quantidade,
            @NotNull @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal precoUnitarioEsperado
    ) { }
}
