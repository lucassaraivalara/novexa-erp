package br.com.novexa.erp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "produtos",
        indexes = {
                @Index(name = "idx_produto_empresa", columnList = "empresa_id"),
                @Index(
                        name = "uk_produto_empresa_codigo_interno",
                        columnList = "empresa_id, codigo_interno",
                        unique = true
                ),
                @Index(
                        name = "uk_produto_empresa_codigo_barras",
                        columnList = "empresa_id, codigo_barras",
                        unique = true
                )
        }
)
public class ProdutoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(
            name = "empresa_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "fk_produto_empresa")
    )
    private EmpresaEntity empresa;

    @Column(name = "codigo_interno", length = 60)
    private String codigoInterno;

    @Column(name = "codigo_barras", length = 60)
    private String codigoBarras;

    @Column(nullable = false)
    private String nome;

    @Column(length = 2000)
    private String descricao;

    @Column(name = "unidade_medida", nullable = false, length = 10)
    private String unidadeMedida;

    @Column(name = "preco_custo", nullable = false, precision = 19, scale = 2)
    private BigDecimal precoCusto = BigDecimal.ZERO;

    @Column(name = "preco_venda", nullable = false, precision = 19, scale = 2)
    private BigDecimal precoVenda;

    @Column(name = "estoque_atual", nullable = false, precision = 19, scale = 3)
    private BigDecimal estoqueAtual = BigDecimal.ZERO;

    @Column(name = "estoque_minimo", nullable = false, precision = 19, scale = 3)
    private BigDecimal estoqueMinimo = BigDecimal.ZERO;

    @Column(name = "controla_estoque", nullable = false)
    private Boolean controlaEstoque = true;

    @Column(nullable = false)
    private Boolean ativo = true;

    @Column(name = "data_cadastro", nullable = false, updatable = false)
    private LocalDateTime dataCadastro;

    public ProdutoEntity() {
    }

    @PrePersist
    private void preencherDadosIniciais() {
        if (precoCusto == null) {
            precoCusto = BigDecimal.ZERO;
        }

        if (estoqueAtual == null) {
            estoqueAtual = BigDecimal.ZERO;
        }

        if (estoqueMinimo == null) {
            estoqueMinimo = BigDecimal.ZERO;
        }

        if (controlaEstoque == null) {
            controlaEstoque = true;
        }

        if (ativo == null) {
            ativo = true;
        }

        if (dataCadastro == null) {
            dataCadastro = LocalDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public EmpresaEntity getEmpresa() {
        return empresa;
    }

    public void setEmpresa(EmpresaEntity empresa) {
        this.empresa = empresa;
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

    public LocalDateTime getDataCadastro() {
        return dataCadastro;
    }

    public void setDataCadastro(LocalDateTime dataCadastro) {
        this.dataCadastro = dataCadastro;
    }
}
