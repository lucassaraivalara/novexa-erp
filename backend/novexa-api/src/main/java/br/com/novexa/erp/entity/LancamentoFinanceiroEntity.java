package br.com.novexa.erp.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

// Registro bruto da venda; liquidação de cartão e taxas pertencem ao módulo financeiro.
@Entity
@Table(name = "lancamentos_financeiros")
public class LancamentoFinanceiroEntity {
    public enum Situacao { RECEBIDO, A_RECEBER, CANCELADO }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false) @JoinColumn(nullable = false) private EmpresaEntity empresa;
    @OneToOne(optional = false) @JoinColumn(nullable = false, unique = true) private VendaEntity venda;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private FormaPagamento formaPagamento;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private Situacao situacao;
    @Column(nullable = false, precision = 19, scale = 2) private BigDecimal valor;
    @Column(nullable = false) private LocalDateTime dataHora;

    protected LancamentoFinanceiroEntity() { }
    public LancamentoFinanceiroEntity(VendaEntity venda) {
        this.empresa = venda.getEmpresa(); this.venda = venda;
        this.formaPagamento = venda.getFormaPagamento(); this.valor = venda.getTotal();
        this.dataHora = venda.getDataHora();
        this.situacao = switch (formaPagamento) {
            case DINHEIRO, PIX -> Situacao.RECEBIDO;
            case CARTAO_DEBITO, CARTAO_CREDITO -> Situacao.A_RECEBER;
        };
    }
    public void cancelar() { this.situacao = Situacao.CANCELADO; }

    public Long getId() { return id; }
    public BigDecimal getValor() { return valor; }
    public Situacao getSituacao() { return situacao; }
    public VendaEntity getVenda() { return venda; }
    public EmpresaEntity getEmpresa() { return empresa; }
}
