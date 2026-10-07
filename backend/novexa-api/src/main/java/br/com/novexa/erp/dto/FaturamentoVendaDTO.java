package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.FormaPagamento;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.UUID;
import java.util.List;

public record FaturamentoVendaDTO(
        @NotNull UUID chaveRequisicao,
        @NotNull @DecimalMin("0.01") @Digits(integer = 12, fraction = 2) BigDecimal totalEsperado,
        FormaPagamento formaPagamento,
        @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal valorRecebido,
        @Positive Long formaPagamentoId,
        @Positive Long sessaoCaixaId,
        @Positive Long configuracaoFormaPagamentoId,
        @Size(max = 20) List<@NotNull @Valid PagamentoVendaRequestDTO> pagamentos,
        @Size(min = 1, max = 120) List<@NotNull @Valid ParcelaPrazoVendaDTO> parcelasPrazo
) {
    public FaturamentoVendaDTO(UUID chaveRequisicao, BigDecimal totalEsperado, FormaPagamento formaPagamento,
            BigDecimal valorRecebido, Long formaPagamentoId, Long sessaoCaixaId, Long configuracaoFormaPagamentoId,
            List<PagamentoVendaRequestDTO> pagamentos) {
        this(chaveRequisicao, totalEsperado, formaPagamento, valorRecebido, formaPagamentoId, sessaoCaixaId,
                configuracaoFormaPagamentoId, pagamentos, null);
    }
    public FaturamentoVendaDTO(UUID chaveRequisicao, BigDecimal totalEsperado, FormaPagamento formaPagamento,
            BigDecimal valorRecebido, Long formaPagamentoId, Long sessaoCaixaId, Long configuracaoFormaPagamentoId) {
        this(chaveRequisicao, totalEsperado, formaPagamento, valorRecebido, formaPagamentoId, sessaoCaixaId, configuracaoFormaPagamentoId, null);
    }
    public FaturamentoVendaDTO(UUID chaveRequisicao, BigDecimal totalEsperado, FormaPagamento formaPagamento,
            BigDecimal valorRecebido, Long formaPagamentoId, Long sessaoCaixaId) {
        this(chaveRequisicao, totalEsperado, formaPagamento, valorRecebido, formaPagamentoId, sessaoCaixaId, null);
    }
    public FaturamentoVendaDTO(UUID chaveRequisicao, BigDecimal totalEsperado, FormaPagamento formaPagamento,
            BigDecimal valorRecebido, Long formaPagamentoId) {
        this(chaveRequisicao, totalEsperado, formaPagamento, valorRecebido, formaPagamentoId, null);
    }
    public FaturamentoVendaDTO(UUID chaveRequisicao, BigDecimal totalEsperado, FormaPagamento formaPagamento,
            BigDecimal valorRecebido) {
        this(chaveRequisicao, totalEsperado, formaPagamento, valorRecebido, null);
    }

    @AssertTrue(message = "Informe pagamentos ou uma forma unica com valorRecebido, sem misturar os formatos.")
    public boolean isFormaInformadaCorretamente() {
        return pagamentos != null || parcelasPrazo != null
                ? formaPagamento == null && formaPagamentoId == null && configuracaoFormaPagamentoId == null && valorRecebido == null
                    && ((pagamentos != null && !pagamentos.isEmpty()) || (parcelasPrazo != null && !parcelasPrazo.isEmpty()))
                : (formaPagamento == null) != (formaPagamentoId == null) && valorRecebido != null;
    }

    // O formato legado é parte do hash de idempotência já persistido.
    @Override public String toString() {
        return "FaturamentoVendaDTO[chaveRequisicao=" + chaveRequisicao + ", totalEsperado=" + totalEsperado
                + ", formaPagamento=" + formaPagamento + ", valorRecebido=" + valorRecebido
                + (formaPagamentoId == null ? "" : ", formaPagamentoId=" + formaPagamentoId) + (sessaoCaixaId == null ? "" : ", sessaoCaixaId=" + sessaoCaixaId)
                + (configuracaoFormaPagamentoId == null ? "" : ", configuracaoFormaPagamentoId=" + configuracaoFormaPagamentoId)
                + (pagamentos == null ? "" : ", pagamentos=" + pagamentos)
                + (parcelasPrazo == null ? "" : ", parcelasPrazo=" + parcelasPrazo) + "]";
    }
}
