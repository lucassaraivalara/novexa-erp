package br.com.novexa.erp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class CaixaRequestDTO {

    @NotBlank(message = "A descrição do caixa é obrigatória.")
    @Size(max = 150, message = "A descrição do caixa deve ter no máximo 150 caracteres.")
    private String descricao;
    private Boolean ativo;

    public CaixaRequestDTO() {
    }

    public String getDescricao() {
        return descricao;
    }

    public void setDescricao(String descricao) {
        this.descricao = descricao;
    }

    public Boolean getAtivo() {
        return ativo;
    }

    public void setAtivo(Boolean ativo) {
        this.ativo = ativo;
    }

    
}
