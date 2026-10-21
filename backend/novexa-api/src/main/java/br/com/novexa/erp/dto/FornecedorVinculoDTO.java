package br.com.novexa.erp.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public class FornecedorVinculoDTO {
    @NotNull(message = "O fornecedor do vínculo é obrigatório.")
    @Positive(message = "O fornecedor do vínculo é inválido.")
    private Long fornecedorId;

    @Size(max = 60, message = "O código de referência deve ter no máximo 60 caracteres.")
    private String codigoReferencia;

    // 1 embalagem comprada = X unidades do produto. Nulo = sem conversao (1:1).
    @DecimalMin(value = "0.001", message = "O fator de conversão deve ser maior que zero.")
    @Digits(integer = 9, fraction = 3, message = "O fator de conversão deve ter até 9 inteiros e 3 casas decimais.")
    private BigDecimal fatorConversao;

    public Long getFornecedorId() { return fornecedorId; }
    public void setFornecedorId(Long fornecedorId) { this.fornecedorId = fornecedorId; }
    public String getCodigoReferencia() { return codigoReferencia; }
    public void setCodigoReferencia(String codigoReferencia) { this.codigoReferencia = codigoReferencia; }
    public BigDecimal getFatorConversao() { return fatorConversao; }
    public void setFatorConversao(BigDecimal fatorConversao) { this.fatorConversao = fatorConversao; }
}
