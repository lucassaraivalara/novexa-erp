package br.com.novexa.erp.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Embeddable
public class VendaItem {
    @Column(nullable = false) private Long produtoId;
    @Column(nullable = false, length = 150) private String nomeProduto;
    @Column(nullable = false, precision = 19, scale = 3) private BigDecimal quantidade;
    @Column(nullable = false, precision = 19, scale = 2) private BigDecimal precoUnitario;
    @Column(nullable = false, precision = 19, scale = 2) private BigDecimal subtotal;
    private Long movimentacaoEstoqueId;

    protected VendaItem() { }
    public VendaItem(ProdutoEntity produto, BigDecimal quantidade, BigDecimal subtotal, Long movimentoId) {
        this.produtoId = produto.getId();
        this.nomeProduto = produto.getNome();
        this.quantidade = quantidade;
        this.precoUnitario = produto.getPrecoVenda();
        this.subtotal = subtotal;
        this.movimentacaoEstoqueId = movimentoId;
    }
    public Long getProdutoId() { return produtoId; }
    public String getNomeProduto() { return nomeProduto; }
    public BigDecimal getQuantidade() { return quantidade; }
    public BigDecimal getPrecoUnitario() { return precoUnitario; }
    public BigDecimal getSubtotal() { return subtotal; }
    public Long getMovimentacaoEstoqueId() { return movimentacaoEstoqueId; }
}
