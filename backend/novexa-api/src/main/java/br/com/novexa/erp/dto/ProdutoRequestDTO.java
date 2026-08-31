package br.com.novexa.erp.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public class ProdutoRequestDTO {

    @NotNull(message = "A empresa é obrigatória.")
    private Long empresaId;

    @Size(max = 60, message = "O código interno deve ter no máximo 60 caracteres.")
    private String codigoInterno;

    @Size(max = 60, message = "O código de barras deve ter no máximo 60 caracteres.")
    private String codigoBarras;

    @NotBlank(message = "O nome do produto é obrigatório.")
    @Size(max = 150, message = "O nome do produto deve ter no máximo 150 caracteres.")
    private String nome;

    @Size(max = 2000, message = "A descrição deve ter no máximo 2000 caracteres.")
    private String descricao;

    @NotBlank(message = "A unidade de medida é obrigatória.")
    @Size(max = 10, message = "A unidade de medida deve ter no máximo 10 caracteres.")
    private String unidadeMedida;

    @DecimalMin(value = "0.00", message = "O preço de custo não pode ser negativo.")
    private BigDecimal precoCusto;

    @NotNull(message = "O preço de venda é obrigatório.")
    @DecimalMin(value = "0.00", message = "O preço de venda não pode ser negativo.")
    private BigDecimal precoVenda;

    @DecimalMin(value = "0.00", message = "O estoque atual não pode ser negativo.")
    private BigDecimal estoqueAtual;

    @DecimalMin(value = "0.00", message = "O estoque mínimo não pode ser negativo.")
    private BigDecimal estoqueMinimo;

    private Boolean controlaEstoque;
    private Boolean ativo;

    public ProdutoRequestDTO() {
    }

    public Long getEmpresaId() {
        return empresaId;
    }

    public void setEmpresaId(Long empresaId) {
        this.empresaId = empresaId;
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

    public BigDecimal getEstoqueAtual() {
        return estoqueAtual;
    }

    public void setEstoqueAtual(BigDecimal estoqueAtual) {
        this.estoqueAtual = estoqueAtual;
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
