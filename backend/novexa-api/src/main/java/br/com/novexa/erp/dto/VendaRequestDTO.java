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
        @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal valorRecebido,
        @Size(max = 500) String entrega,
        @Size(max = 2000) String observacoes,
        @Positive Long formaPagamentoId,
        @Positive Long sessaoCaixaId,
        @Positive Long configuracaoFormaPagamentoId,
        @Size(max = 20) List<@NotNull @Valid PagamentoVendaRequestDTO> pagamentos,
        @Size(min = 1, max = 120) List<@NotNull @Valid ParcelaPrazoVendaDTO> parcelasPrazo
) {
    public VendaRequestDTO(UUID chaveRequisicao, List<Item> itens, Long clienteId, BigDecimal desconto,
            BigDecimal totalEsperado, FormaPagamento formaPagamento, BigDecimal valorRecebido,
            String entrega, String observacoes, Long formaPagamentoId, Long sessaoCaixaId, Long configuracaoFormaPagamentoId,
            List<PagamentoVendaRequestDTO> pagamentos) {
        this(chaveRequisicao, itens, clienteId, desconto, totalEsperado, formaPagamento, valorRecebido,
                entrega, observacoes, formaPagamentoId, sessaoCaixaId, configuracaoFormaPagamentoId, pagamentos, null);
    }
    public VendaRequestDTO(UUID chaveRequisicao, List<Item> itens, Long clienteId, BigDecimal desconto,
            BigDecimal totalEsperado, FormaPagamento formaPagamento, BigDecimal valorRecebido,
            String entrega, String observacoes, Long formaPagamentoId, Long sessaoCaixaId, Long configuracaoFormaPagamentoId) {
        this(chaveRequisicao, itens, clienteId, desconto, totalEsperado, formaPagamento, valorRecebido,
                entrega, observacoes, formaPagamentoId, sessaoCaixaId, configuracaoFormaPagamentoId, null);
    }
    public VendaRequestDTO(UUID chaveRequisicao, List<Item> itens, Long clienteId, BigDecimal desconto,
            BigDecimal totalEsperado, FormaPagamento formaPagamento, BigDecimal valorRecebido,
            String entrega, String observacoes, Long formaPagamentoId, Long sessaoCaixaId) {
        this(chaveRequisicao, itens, clienteId, desconto, totalEsperado, formaPagamento, valorRecebido,
                entrega, observacoes, formaPagamentoId, sessaoCaixaId, null);
    }
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

    @AssertTrue(message = "Informe pagamentos ou uma forma unica com valorRecebido, sem misturar os formatos.")
    public boolean isFormaInformadaCorretamente() {
        return pagamentos != null || parcelasPrazo != null
                ? formaPagamento == null && formaPagamentoId == null && configuracaoFormaPagamentoId == null && valorRecebido == null
                    && ((pagamentos != null && !pagamentos.isEmpty()) || (parcelasPrazo != null && !parcelasPrazo.isEmpty()))
                : (formaPagamento == null) != (formaPagamentoId == null) && valorRecebido != null;
    }

    // Preserva o resumo usado por retries de vendas anteriores à introdução do ID.
    @Override public String toString() {
        return "VendaRequestDTO[chaveRequisicao=" + chaveRequisicao + ", itens=" + itens
                + ", clienteId=" + clienteId + ", desconto=" + desconto + ", totalEsperado=" + totalEsperado
                + ", formaPagamento=" + formaPagamento + ", valorRecebido=" + valorRecebido
                + ", entrega=" + entrega + ", observacoes=" + observacoes
                + (formaPagamentoId == null ? "" : ", formaPagamentoId=" + formaPagamentoId) + (sessaoCaixaId == null ? "" : ", sessaoCaixaId=" + sessaoCaixaId)
                + (configuracaoFormaPagamentoId == null ? "" : ", configuracaoFormaPagamentoId=" + configuracaoFormaPagamentoId)
                + (pagamentos == null ? "" : ", pagamentos=" + pagamentos)
                + (parcelasPrazo == null ? "" : ", parcelasPrazo=" + parcelasPrazo) + "]";
    }

    public record Item(
            @NotNull @Positive Long produtoId,
            @NotNull @DecimalMin("0.001") @Digits(integer = 9, fraction = 3) BigDecimal quantidade,
            @NotNull @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal precoUnitarioEsperado
    ) { }
}
