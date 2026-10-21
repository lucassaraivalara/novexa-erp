package br.com.novexa.erp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
        name = "produto_fornecedor",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_produto_fornecedor_vinc_par", columnNames = {"produto_id", "fornecedor_id"}),
                @UniqueConstraint(name = "uk_produto_fornecedor_vinc_empresa", columnNames = {"id", "empresa_id"})
        },
        indexes = @Index(name = "idx_produto_fornecedor_vinc_empresa", columnList = "empresa_id,fornecedor_id")
)
public class ProdutoFornecedorEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "empresa_id", nullable = false, foreignKey = @ForeignKey(name = "fk_produto_fornecedor_vinc_empresa"))
    private EmpresaEntity empresa;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "produto_id", nullable = false, foreignKey = @ForeignKey(name = "fk_produto_fornecedor_vinc_produto"))
    private ProdutoEntity produto;

    @ManyToOne(optional = false)
    @JoinColumn(name = "fornecedor_id", nullable = false, foreignKey = @ForeignKey(name = "fk_produto_fornecedor_vinc_fornecedor"))
    private FornecedorEntity fornecedor;

    @Column(name = "codigo_referencia", length = 60)
    private String codigoReferencia;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public EmpresaEntity getEmpresa() { return empresa; }
    public void setEmpresa(EmpresaEntity empresa) { this.empresa = empresa; }
    public ProdutoEntity getProduto() { return produto; }
    public void setProduto(ProdutoEntity produto) { this.produto = produto; }
    public FornecedorEntity getFornecedor() { return fornecedor; }
    public void setFornecedor(FornecedorEntity fornecedor) { this.fornecedor = fornecedor; }
    public String getCodigoReferencia() { return codigoReferencia; }
    public void setCodigoReferencia(String codigoReferencia) { this.codigoReferencia = codigoReferencia; }
}
