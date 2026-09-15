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
        Long clienteId,
        @NotNull @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal desconto,
        @NotNull @DecimalMin("0.01") @Digits(integer = 12, fraction = 2) BigDecimal totalEsperado,
        FormaPagamento formaPagamento,
        @NotNull @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal valorRecebido,
        @Size(max = 500) String entrega,
        @Size(max = 2000) String observacoes,
        @Positive Long formaPagamentoId,
        @Positive Long sessaoCaixaId
) {
    public VendaRequestDTO(UUID chaveRequisicao, List<Item> itens, Long clienteId, BigDecimal desconto,
            BigDecimal totalEsperado, FormaPagamento formaPagamento, BigDecimal valorRecebido,
            String entrega, String observacoes, Long formaPagamentoId) {
        this(chaveRequisicao, itens, clienteId, desconto, totalEsperado, formaPagamento, valorRecebido,
                entrega, observacoes, formaPagamentoId, null);
    }
    public VendaRequestDTO(UUID chaveRequisicao, List<Item> itens, Long clienteId, BigDecimal desconto,
            BigDecimal totalEsperado, FormaPagamento formaPagamento, BigDecimal valorRecebido,
            String entrega, String observacoes) {
        this(chaveRequisicao, itens, clienteId, desconto, totalEsperado, formaPagamento, valorRecebido,
                entrega, observacoes, null);
    }

    @AssertTrue(message = "Informe somente formaPagamentoId ou formaPagamento.")
    public boolean isFormaInformadaCorretamente() { return (formaPagamento == null) != (formaPagamentoId == null); }

    // Preserva o resumo usado por retries de vendas anteriores à introdução do ID.
    @Override public String toString() {
        return "VendaRequestDTO[chaveRequisicao=" + chaveRequisicao + ", itens=" + itens
                + ", clienteId=" + clienteId + ", desconto=" + desconto + ", totalEsperado=" + totalEsperado
                + ", formaPagamento=" + formaPagamento + ", valorRecebido=" + valorRecebido
                + ", entrega=" + entrega + ", observacoes=" + observacoes
                + (formaPagamentoId == null ? "" : ", formaPagamentoId=" + formaPagamentoId) + (sessaoCaixaId == null ? "" : ", sessaoCaixaId=" + sessaoCaixaId) + "]";
    }

    public record Item(
            @NotNull @Positive Long produtoId,
            @NotNull @DecimalMin("0.001") @Digits(integer = 9, fraction = 3) BigDecimal quantidade,
            @NotNull @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal precoUnitarioEsperado
    ) { }
}
