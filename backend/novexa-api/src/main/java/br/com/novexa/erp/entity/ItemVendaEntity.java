package br.com.novexa.erp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;

@Entity
@Table(name = "itens_venda")
public class ItemVendaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "venda_id", nullable = false)
    private VendaEntity venda;

    @ManyToOne(optional = false)
    @JoinColumn(name = "produto_id", nullable = false)
    private ProdutoEntity produto;

    @Column(name = "nome_produto", nullable = false, length = 150)
    private String nomeProduto;

    @Column(name = "quantidade", nullable = false, precision = 19, scale = 3)
    private BigDecimal quantidade;

    @Column(name = "preco_unitario", nullable = false, precision = 19, scale = 2)
    private BigDecimal precoUnitario;

    @Column(name = "subtotal", nullable = false, precision = 19, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "movimentacao_estoque_id")
    private Long movimentacaoEstoqueId;

    @Column(name = "ordem", nullable = false)
    private Integer ordem;

    protected ItemVendaEntity() { }

    public ItemVendaEntity(VendaEntity venda, ProdutoEntity produto, BigDecimal quantidade,
                           BigDecimal precoUnitario, BigDecimal subtotal) {
        this(venda, produto, quantidade, precoUnitario, subtotal, null, null);
    }

    public ItemVendaEntity(VendaEntity venda, ProdutoEntity produto, BigDecimal quantidade,
                           BigDecimal precoUnitario, BigDecimal subtotal, Long movimentacaoEstoqueId,
                           Integer ordem) {
        this.venda = venda;
        this.produto = produto;
        this.nomeProduto = produto.getNome();
        this.quantidade = quantidade;
        this.precoUnitario = precoUnitario;
        this.subtotal = subtotal;
        this.movimentacaoEstoqueId = movimentacaoEstoqueId;
        this.ordem = ordem == null ? 0 : ordem;
    }

    public Long getId() { return id; }
    public VendaEntity getVenda() { return venda; }
    public ProdutoEntity getProduto() { return produto; }
    public String getNomeProduto() { return nomeProduto; }
    public BigDecimal getQuantidade() { return quantidade; }
    public BigDecimal getPrecoUnitario() { return precoUnitario; }
    public BigDecimal getSubtotal() { return subtotal; }
    public Long getMovimentacaoEstoqueId() { return movimentacaoEstoqueId; }
    public Integer getOrdem() { return ordem; }
    public void setQuantidade(BigDecimal quantidade) { this.quantidade = quantidade; }
    public void setSubtotal(BigDecimal subtotal) { this.subtotal = subtotal; }
    public void setMovimentacaoEstoqueId(Long movimentacaoEstoqueId) {
        this.movimentacaoEstoqueId = movimentacaoEstoqueId;
    }
    public void setOrdem(Integer ordem) { this.ordem = ordem; }
}
