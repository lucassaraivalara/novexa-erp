package br.com.novexa.erp.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public class FornecedorVinculoDTO {
    @NotNull(message = "O fornecedor do vínculo é obrigatório.")
    @Positive(message = "O fornecedor do vínculo é inválido.")
    private Long fornecedorId;

    @Size(max = 60, message = "O código de referência deve ter no máximo 60 caracteres.")
    private String codigoReferencia;

    public Long getFornecedorId() { return fornecedorId; }
    public void setFornecedorId(Long fornecedorId) { this.fornecedorId = fornecedorId; }
    public String getCodigoReferencia() { return codigoReferencia; }
    public void setCodigoReferencia(String codigoReferencia) { this.codigoReferencia = codigoReferencia; }
}
