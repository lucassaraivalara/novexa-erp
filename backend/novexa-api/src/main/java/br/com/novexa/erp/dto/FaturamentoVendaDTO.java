package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.FormaPagamento;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.UUID;

public record FaturamentoVendaDTO(
        @NotNull UUID chaveRequisicao,
        @NotNull @DecimalMin("0.01") @Digits(integer = 12, fraction = 2) BigDecimal totalEsperado,
        FormaPagamento formaPagamento,
        @NotNull @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal valorRecebido,
        @Positive Long formaPagamentoId,
        @Positive Long sessaoCaixaId
) {
    public FaturamentoVendaDTO(UUID chaveRequisicao, BigDecimal totalEsperado, FormaPagamento formaPagamento,
            BigDecimal valorRecebido, Long formaPagamentoId) {
        this(chaveRequisicao, totalEsperado, formaPagamento, valorRecebido, formaPagamentoId, null);
    }
    public FaturamentoVendaDTO(UUID chaveRequisicao, BigDecimal totalEsperado, FormaPagamento formaPagamento,
            BigDecimal valorRecebido) {
        this(chaveRequisicao, totalEsperado, formaPagamento, valorRecebido, null);
    }

    @AssertTrue(message = "Informe somente formaPagamentoId ou formaPagamento.")
    public boolean isFormaInformadaCorretamente() { return (formaPagamento == null) != (formaPagamentoId == null); }

    // O formato legado é parte do hash de idempotência já persistido.
    @Override public String toString() {
        return "FaturamentoVendaDTO[chaveRequisicao=" + chaveRequisicao + ", totalEsperado=" + totalEsperado
                + ", formaPagamento=" + formaPagamento + ", valorRecebido=" + valorRecebido
                + (formaPagamentoId == null ? "" : ", formaPagamentoId=" + formaPagamentoId) + (sessaoCaixaId == null ? "" : ", sessaoCaixaId=" + sessaoCaixaId) + "]";
    }
}
