package br.com.novexa.erp.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import java.io.IOException;

public record ConfiguracaoFormaPagamentoEmpresaRequestDTO(
        @NotNull @Positive Long formaPagamentoId,
        @NotBlank @Size(max = 150) String nomeExibicao,
        Boolean ativo,
        @Positive Long contaFinanceiraDestinoId,
        @DecimalMin("0") @DecimalMax("100") @Digits(integer = 3, fraction = 4) BigDecimal taxaPercentual,
        @DecimalMin("0") @Digits(integer = 17, fraction = 2) BigDecimal taxaFixa,
        @Min(0) @JsonDeserialize(using = PrazoEmDiasDeserializer.class) Integer prazoRecebimentoDias) {
    public ConfiguracaoFormaPagamentoEmpresaRequestDTO(Long formaPagamentoId, String nomeExibicao,
            Boolean ativo, Long contaFinanceiraDestinoId) {
        this(formaPagamentoId, nomeExibicao, ativo, contaFinanceiraDestinoId, null, null, null);
    }
    public static final class PrazoEmDiasDeserializer extends JsonDeserializer<Integer> {
        @Override public Integer deserialize(JsonParser p, DeserializationContext context) throws IOException {
            if (!p.hasToken(JsonToken.VALUE_NUMBER_INT))
                return context.reportInputMismatch(Integer.class, "prazoRecebimentoDias deve ser inteiro.");
            return p.getIntValue();
        }
    }
}
