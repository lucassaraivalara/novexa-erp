package br.com.novexa.erp.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public record PagamentoVendaRequestDTO(
        @NotNull @Positive Long configuracaoFormaPagamentoId,
        @NotNull @DecimalMin("0.01") @Digits(integer = 12, fraction = 2) BigDecimal valor,
        @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal valorRecebido,
        @Min(1) @Max(12) @com.fasterxml.jackson.databind.annotation.JsonDeserialize(
                using = ConfiguracaoFormaPagamentoEmpresaRequestDTO.ParcelasConsumidorDeserializer.class) Integer parcelasConsumidor
) {
    public PagamentoVendaRequestDTO(Long configuracaoFormaPagamentoId, BigDecimal valor, BigDecimal valorRecebido) {
        this(configuracaoFormaPagamentoId, valor, valorRecebido, null);
    }
    // O formato anterior integra hashes persistidos; omissão e 1x são equivalentes.
    @Override public String toString() {
        return "PagamentoVendaRequestDTO[configuracaoFormaPagamentoId=" + configuracaoFormaPagamentoId
                + ", valor=" + valor + ", valorRecebido=" + valorRecebido
                + (parcelasConsumidor == null || parcelasConsumidor == 1 ? "" : ", parcelasConsumidor=" + parcelasConsumidor) + "]";
    }
}
