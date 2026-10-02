package br.com.novexa.erp.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record EntradaMercadoriaRequestDTO(
        @NotNull @Positive Long fornecedorId,
        @Size(max = 60) String numeroNota,
        @Size(max = 20) String serie,
        @Pattern(regexp = "(?:[0-9]{44})?", message = "Chave NF-e deve conter 44 digitos.") String chaveAcessoNfe,
        LocalDate dataEmissao,
        LocalDate dataEntrada,
        @Size(max = 2000) String observacao,
        @NotEmpty @Size(max = 200) List<@NotNull @Valid Item> itens,
        UUID chaveRequisicao
) {
    public record Item(
            @NotNull @Positive Long produtoId,
            @NotNull @DecimalMin("0.001") @Digits(integer = 9, fraction = 3) BigDecimal quantidade,
            @NotNull @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal valorUnitario,
            @Size(max = 255) String descricaoOriginal,
            @Size(max = 60) String codigoProdutoFornecedor,
            @Size(max = 14) String gtin,
            @Size(max = 8) String ncm,
            @Size(max = 4) String cfop,
            @Size(max = 10) String unidade
    ) { }
}
