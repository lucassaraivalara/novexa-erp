package br.com.novexa.erp.dto;

import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public class MovimentacaoEstoqueRequestDTO {

    @NotNull(message = "Produto é obrigatório.")
    private Long produtoId;

    @NotNull(message = "Quantidade é obrigatória.")
    private BigDecimal quantidade;

    private String motivo;

    public MovimentacaoEstoqueRequestDTO() {
    }

    public Long getProdutoId() {
        return produtoId;
    }

    public void setProdutoId(Long produtoId) {
        this.produtoId = produtoId;
    }

    public BigDecimal getQuantidade() {
        return quantidade;
    }

    public void setQuantidade(BigDecimal quantidade) {
        this.quantidade = quantidade;
    }

    public String getMotivo() {
        return motivo;
    }

    public void setMotivo(String motivo) {
        this.motivo = motivo;
    }
}