package br.com.novexa.erp.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "vendas", uniqueConstraints = @UniqueConstraint(name = "uk_venda_requisicao",
        columnNames = {"empresa_id", "usuario_id", "chave_requisicao"}))
public class VendaEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false) @JoinColumn(nullable = false) private EmpresaEntity empresa;
    @ManyToOne(optional = false) @JoinColumn(nullable = false) private UsuarioEntity usuario;
    @ManyToOne private ClienteEntity cliente;
    @Column(length = 20) private UUID chaveRequisicao;
    @Column(length = 64) private String resumoRequisicao;
    @Column(nullable = false) private LocalDateTime dataHora;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private StatusVenda status;
    @Column(precision = 19, scale = 2) private BigDecimal subtotal;
    @Column(precision = 19, scale = 2) private BigDecimal desconto;
    @Column(precision = 19, scale = 2) private BigDecimal total;
    @Enumerated(EnumType.STRING) @Column(length = 20) private FormaPagamento formaPagamento;
    @Column(precision = 19, scale = 2) private BigDecimal valorRecebido;
    @Column(precision = 19, scale = 2) private BigDecimal troco;
    @Column(length = 500) private String entrega;
    @Column(length = 2000) private String observacoes;
    @OneToMany(mappedBy = "venda")
    private List<ItemVendaEntity> itemVendas = new ArrayList<>();
    @ElementCollection @CollectionTable(name = "venda_itens", joinColumns = @JoinColumn(name = "venda_id"))
    @OrderColumn(name = "ordem") private List<VendaItem> itens = new ArrayList<>();

    protected VendaEntity() { }
    public VendaEntity(UsuarioEntity usuario, ClienteEntity cliente, UUID chave, String resumo,
                       BigDecimal subtotal, BigDecimal desconto, BigDecimal total, FormaPagamento forma,
                       BigDecimal recebido, BigDecimal troco, String entrega, String observacoes) {
        this.empresa = usuario.getEmpresa(); this.usuario = usuario; this.cliente = cliente;
        this.chaveRequisicao = chave; this.resumoRequisicao = resumo; this.dataHora = LocalDateTime.now();
        this.status = StatusVenda.ABERTA;
        this.subtotal = subtotal; this.desconto = desconto; this.total = total; this.formaPagamento = forma;
        this.valorRecebido = recebido; this.troco = troco; this.entrega = entrega; this.observacoes = observacoes;
    }
    public VendaEntity(UsuarioEntity usuario, ClienteEntity cliente) {
        this.empresa = usuario.getEmpresa(); this.usuario = usuario; this.cliente = cliente;
        this.dataHora = LocalDateTime.now();
        this.status = StatusVenda.ABERTA;
        this.subtotal = BigDecimal.ZERO; this.desconto = BigDecimal.ZERO; this.total = BigDecimal.ZERO;
    }
    public Long getId() { return id; }
    public EmpresaEntity getEmpresa() { return empresa; }
    public UsuarioEntity getUsuario() { return usuario; }
    public ClienteEntity getCliente() { return cliente; }
    public UUID getChaveRequisicao() { return chaveRequisicao; }
    public String getResumoRequisicao() { return resumoRequisicao; }
    public LocalDateTime getDataHora() { return dataHora; }
    public StatusVenda getStatus() { return status; }
    public void setStatus(StatusVenda status) { this.status = status; }
    public BigDecimal getSubtotal() { return subtotal; }
    public BigDecimal getDesconto() { return desconto; }
    public BigDecimal getTotal() { return total; }
    public FormaPagamento getFormaPagamento() { return formaPagamento; }
    public BigDecimal getValorRecebido() { return valorRecebido; }
    public BigDecimal getTroco() { return troco; }
    public List<VendaItem> getItens() { return itens; }
    public List<ItemVendaEntity> getItemVendas() { return itemVendas; }
    public String getEntrega() { return entrega; }
    public String getObservacoes() { return observacoes; }
    public void setSubtotal(BigDecimal subtotal) { this.subtotal = subtotal; }
    public void setDesconto(BigDecimal desconto) { this.desconto = desconto; }
    public void setTotal(BigDecimal total) { this.total = total; }
    public void setCliente(ClienteEntity cliente) { this.cliente = cliente; }
}
