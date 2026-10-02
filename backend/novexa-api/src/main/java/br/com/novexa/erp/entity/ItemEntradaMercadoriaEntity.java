package br.com.novexa.erp.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "itens_entrada_mercadoria")
public class ItemEntradaMercadoriaEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "empresa_id", nullable = false, updatable = false) private EmpresaEntity empresa;
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "entrada_id", nullable = false, updatable = false) private EntradaMercadoriaEntity entrada;
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "produto_id", nullable = false) private ProdutoEntity produto;
    @Column(nullable = false) private int ordem;
    @Column(length = 255) private String descricaoOriginal;
    @Column(length = 60) private String codigoProdutoFornecedor;
    @Column(nullable = false, precision = 19, scale = 3) private BigDecimal quantidade;
    @Column(nullable = false, precision = 19, scale = 2) private BigDecimal valorUnitario;
    @Column(nullable = false, precision = 19, scale = 2) private BigDecimal valorTotal;
    @Column(length = 14) private String gtin;
    @Column(length = 8) private String ncm;
    @Column(length = 4) private String cfop;
    @Column(length = 10) private String unidade;
    private Long movimentacaoEstoqueId;
    private Long movimentacaoCancelamentoId;

    public Long getId() { return id; }
    public EmpresaEntity getEmpresa() { return empresa; }
    public void setEmpresa(EmpresaEntity v) { empresa = v; }
    public EntradaMercadoriaEntity getEntrada() { return entrada; }
    public void setEntrada(EntradaMercadoriaEntity v) { entrada = v; }
    public ProdutoEntity getProduto() { return produto; }
    public void setProduto(ProdutoEntity v) { produto = v; }
    public int getOrdem() { return ordem; }
    public void setOrdem(int v) { ordem = v; }
    public String getDescricaoOriginal() { return descricaoOriginal; }
    public void setDescricaoOriginal(String v) { descricaoOriginal = v; }
    public String getCodigoProdutoFornecedor() { return codigoProdutoFornecedor; }
    public void setCodigoProdutoFornecedor(String v) { codigoProdutoFornecedor = v; }
    public BigDecimal getQuantidade() { return quantidade; }
    public void setQuantidade(BigDecimal v) { quantidade = v; }
    public BigDecimal getValorUnitario() { return valorUnitario; }
    public void setValorUnitario(BigDecimal v) { valorUnitario = v; }
    public BigDecimal getValorTotal() { return valorTotal; }
    public void setValorTotal(BigDecimal v) { valorTotal = v; }
    public String getGtin() { return gtin; }
    public void setGtin(String v) { gtin = v; }
    public String getNcm() { return ncm; }
    public void setNcm(String v) { ncm = v; }
    public String getCfop() { return cfop; }
    public void setCfop(String v) { cfop = v; }
    public String getUnidade() { return unidade; }
    public void setUnidade(String v) { unidade = v; }
    public Long getMovimentacaoEstoqueId() { return movimentacaoEstoqueId; }
    public void setMovimentacaoEstoqueId(Long v) { movimentacaoEstoqueId = v; }
    public Long getMovimentacaoCancelamentoId() { return movimentacaoCancelamentoId; }
    public void setMovimentacaoCancelamentoId(Long v) { movimentacaoCancelamentoId = v; }
}
