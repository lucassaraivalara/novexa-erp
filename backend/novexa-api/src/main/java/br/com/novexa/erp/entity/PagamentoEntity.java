package br.com.novexa.erp.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "pagamentos", uniqueConstraints = @UniqueConstraint(
        name = "uk_pagamento_venda_sequencia", columnNames = {"venda_id", "sequencia"}))
public class PagamentoEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false) @JoinColumn(nullable = false) private EmpresaEntity empresa;
    @ManyToOne(optional = false) @JoinColumn(nullable = false) private VendaEntity venda;
    @ManyToOne(optional = false) @JoinColumn(nullable = false) private UsuarioEntity usuario;
    @Column(nullable = false) private int sequencia;
    @Column(nullable = false) private UUID chaveRequisicao;
    // Snapshot do código de fechamento para preservar a resposta histórica do PDV.
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20, updatable = false) private FormaPagamento formaPagamento;
    @ManyToOne(optional = false)
    @JoinColumn(name = "forma_pagamento_id", nullable = false, updatable = false)
    private FormaPagamentoEntity forma;
    @Column(nullable = false, precision = 19, scale = 2) private BigDecimal valor;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private StatusPagamento status;
    @Column(nullable = false) private LocalDateTime dataHora;
    @Column(precision = 19, scale = 2) private BigDecimal valorRecebido;
    @Column(precision = 19, scale = 2) private BigDecimal troco;

    protected PagamentoEntity() { }

    public PagamentoEntity(VendaEntity venda, UsuarioEntity operador, FormaPagamentoEntity forma) {
        if (venda.getStatus() != StatusVenda.FATURADA) {
            throw new IllegalArgumentException("Pagamento exige venda faturada.");
        }
        if (!Objects.equals(venda.getEmpresa().getId(), operador.getEmpresa().getId())) {
            throw new IllegalArgumentException("Operador e venda devem pertencer à mesma empresa.");
        }
        this.empresa = venda.getEmpresa();
        this.venda = venda;
        this.usuario = operador;
        // O contrato atual possui um pagamento. Pagamentos adicionais exigirão regra explícita.
        this.sequencia = 1;
        this.chaveRequisicao = Objects.requireNonNull(venda.getChaveRequisicao());
        this.formaPagamento = Objects.requireNonNull(venda.getFormaPagamento());
        if (!forma.isAtivo() || forma.getTipo().contratoVenda() != formaPagamento) {
            throw new IllegalArgumentException("Forma de pagamento indisponível ou incompatível com o fechamento.");
        }
        this.forma = forma;
        this.valor = venda.getTotal();
        this.status = StatusPagamento.REGISTRADO;
        this.dataHora = LocalDateTime.now();
        if (formaPagamento == FormaPagamento.DINHEIRO) {
            this.valorRecebido = venda.getValorRecebido();
            this.troco = venda.getTroco();
        }
    }

    public Long getId() { return id; }
    public EmpresaEntity getEmpresa() { return empresa; }
    public VendaEntity getVenda() { return venda; }
    public UsuarioEntity getUsuario() { return usuario; }
    public int getSequencia() { return sequencia; }
    public UUID getChaveRequisicao() { return chaveRequisicao; }
    public FormaPagamento getFormaPagamento() { return formaPagamento; }
    public FormaPagamentoEntity getForma() { return forma; }
    public BigDecimal getValor() { return valor; }
    public StatusPagamento getStatus() { return status; }
    public LocalDateTime getDataHora() { return dataHora; }
    public BigDecimal getValorRecebido() { return valorRecebido; }
    public BigDecimal getTroco() { return troco; }
}
