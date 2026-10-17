package br.com.novexa.erp.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class ProdutoResponseDTO {
    @jakarta.validation.constraints.Pattern(regexp = "[0-9]{8}", message = "NCM deve conter 8 dígitos.")
    private String ncm;
    public String getNcm() { return ncm; }
    public void setNcm(String valor) { this.ncm = valor; }
    @jakarta.validation.constraints.Pattern(regexp = "[0-9]{7}", message = "CEST deve conter 7 dígitos.")
    private String cest;
    public String getCest() { return cest; }
    public void setCest(String valor) { this.cest = valor; }

    private CategoriaProdutoResponseDTO categoria;
    public CategoriaProdutoResponseDTO getCategoria() { return categoria; }
    public void setCategoria(CategoriaProdutoResponseDTO valor) { this.categoria = valor; }
    private SubcategoriaProdutoResponseDTO subcategoria;
    public SubcategoriaProdutoResponseDTO getSubcategoria() { return subcategoria; }
    public void setSubcategoria(SubcategoriaProdutoResponseDTO valor) { this.subcategoria = valor; }
    private MarcaResponseDTO marca;
    public MarcaResponseDTO getMarca() { return marca; }
    public void setMarca(MarcaResponseDTO valor) { this.marca = valor; }


    private Long id;
    private Long empresaId;
    private FornecedorProdutoResponseDTO fornecedor;

    public FornecedorProdutoResponseDTO getFornecedor() { return fornecedor; }
    public void setFornecedor(FornecedorProdutoResponseDTO fornecedor) { this.fornecedor = fornecedor; }
    private String codigoInterno;
    private String codigoBarras;
    private String nome;
    private String descricao;
    private String unidadeMedida;
    private BigDecimal precoCusto;
    private BigDecimal precoVenda;
    private BigDecimal estoqueAtual;
    private BigDecimal estoqueMinimo;
    private Boolean controlaEstoque;
    private String imagemPath;
    private String imagemUrl;
    private Boolean ativo;
    private LocalDateTime dataCadastro;

    public ProdutoResponseDTO() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
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

    public String getImagemPath() {
        return imagemPath;
    }

    public void setImagemPath(String imagemPath) {
        this.imagemPath = imagemPath;
    }

    public String getImagemUrl() {
        return imagemUrl;
    }

    public void setImagemUrl(String imagemUrl) {
        this.imagemUrl = imagemUrl;
    }

    public Boolean getAtivo() {
        return ativo;
    }

    public void setAtivo(Boolean ativo) {
        this.ativo = ativo;
    }

    public LocalDateTime getDataCadastro() {
        return dataCadastro;
    }

    public void setDataCadastro(LocalDateTime dataCadastro) {
        this.dataCadastro = dataCadastro;
    }
}
