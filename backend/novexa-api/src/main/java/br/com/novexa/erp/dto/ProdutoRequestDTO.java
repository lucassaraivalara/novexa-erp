package br.com.novexa.erp.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public class ProdutoRequestDTO {
    @jakarta.validation.constraints.Pattern(regexp = "[0-9]{8}", message = "NCM deve conter 8 dígitos.")
    private String ncm;
    public String getNcm() { return ncm; }
    @com.fasterxml.jackson.annotation.JsonIgnore
    private boolean ncmInformado;
    public void setNcm(String valor) { this.ncm = valor; this.ncmInformado = true; }
    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean isNcmInformado() { return ncmInformado; }
    @jakarta.validation.constraints.Pattern(regexp = "[0-9]{7}", message = "CEST deve conter 7 dígitos.")
    private String cest;
    public String getCest() { return cest; }
    @com.fasterxml.jackson.annotation.JsonIgnore
    private boolean cestInformado;
    public void setCest(String valor) { this.cest = valor; this.cestInformado = true; }
    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean isCestInformado() { return cestInformado; }


    @Size(max = 60, message = "O código interno deve ter no máximo 60 caracteres.")
    private String codigoInterno;

    @Size(max = 60, message = "O código de barras deve ter no máximo 60 caracteres.")
    private String codigoBarras;

    @jakarta.validation.constraints.Positive
    private Long fornecedorId;
    @com.fasterxml.jackson.annotation.JsonIgnore
    private boolean fornecedorInformado;

    public Long getFornecedorId() { return fornecedorId; }
    public void setFornecedorId(Long fornecedorId) { this.fornecedorId = fornecedorId; this.fornecedorInformado = true; }
    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean isFornecedorInformado() { return fornecedorInformado; }

    @NotBlank(message = "O nome do produto é obrigatório.")
    @Size(max = 150, message = "O nome do produto deve ter no máximo 150 caracteres.")
    private String nome;

    @Size(max = 2000, message = "A descrição deve ter no máximo 2000 caracteres.")
    private String descricao;

    @NotBlank(message = "A unidade de medida é obrigatória.")
    @Size(max = 10, message = "A unidade de medida deve ter no máximo 10 caracteres.")
    private String unidadeMedida;

    @DecimalMin(value = "0.00", message = "O preço de custo não pode ser negativo.")
    @jakarta.validation.constraints.Digits(integer = 17, fraction = 2) private BigDecimal precoCusto;

    @NotNull(message = "O preço de venda é obrigatório.")
    @DecimalMin(value = "0.00", message = "O preço de venda não pode ser negativo.")
    @jakarta.validation.constraints.Digits(integer = 17, fraction = 2) private BigDecimal precoVenda;

    @DecimalMin(value = "0.00", message = "O estoque mínimo não pode ser negativo.")
    @jakarta.validation.constraints.Digits(integer = 16, fraction = 3) private BigDecimal estoqueMinimo;

    private Boolean controlaEstoque;
    private Boolean ativo;

    @jakarta.validation.constraints.Positive
    private Long categoriaId;
    @com.fasterxml.jackson.annotation.JsonIgnore
    private boolean categoriaInformada;
    public Long getCategoriaId() { return categoriaId; }
    public void setCategoriaId(Long id) { this.categoriaId = id; this.categoriaInformada = true; }
    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean isCategoriaInformada() { return categoriaInformada; }

    @jakarta.validation.constraints.Positive
    private Long subcategoriaId;
    @com.fasterxml.jackson.annotation.JsonIgnore
    private boolean subcategoriaInformada;
    public Long getSubcategoriaId() { return subcategoriaId; }
    public void setSubcategoriaId(Long id) { this.subcategoriaId = id; this.subcategoriaInformada = true; }
    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean isSubcategoriaInformada() { return subcategoriaInformada; }

    @jakarta.validation.constraints.Positive
    private Long marcaId;
    @com.fasterxml.jackson.annotation.JsonIgnore
    private boolean marcaInformada;
    public Long getMarcaId() { return marcaId; }
    public void setMarcaId(Long id) { this.marcaId = id; this.marcaInformada = true; }
    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean isMarcaInformada() { return marcaInformada; }

    public ProdutoRequestDTO() {
    }

    public String getCodigoInterno() {
        return codigoInterno;
    }

    public void setCodigoInterno(String codigoInterno) {
        this.codigoInterno = codigoInterno;
    }

    public String getCodigoBarras() {
        return codigoBarras;
    }

    public void setCodigoBarras(String codigoBarras) {
        this.codigoBarras = codigoBarras;
    }

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public String getDescricao() {
        return descricao;
    }

    public void setDescricao(String descricao) {
        this.descricao = descricao;
    }

    public String getUnidadeMedida() {
        return unidadeMedida;
    }

    public void setUnidadeMedida(String unidadeMedida) {
        this.unidadeMedida = unidadeMedida;
    }

    public BigDecimal getPrecoCusto() {
        return precoCusto;
    }

    public void setPrecoCusto(BigDecimal precoCusto) {
        this.precoCusto = precoCusto;
    }

    public BigDecimal getPrecoVenda() {
        return precoVenda;
    }

    public void setPrecoVenda(BigDecimal precoVenda) {
        this.precoVenda = precoVenda;
    }

    public BigDecimal getEstoqueMinimo() {
        return estoqueMinimo;
    }

    public void setEstoqueMinimo(BigDecimal estoqueMinimo) {
        this.estoqueMinimo = estoqueMinimo;
    }

    public Boolean getControlaEstoque() {
        return controlaEstoque;
    }

    public void setControlaEstoque(Boolean controlaEstoque) {
        this.controlaEstoque = controlaEstoque;
    }

    public Boolean getAtivo() {
        return ativo;
    }

    public void setAtivo(Boolean ativo) {
        this.ativo = ativo;
    }
}
