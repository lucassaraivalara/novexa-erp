package br.com.novexa.erp.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

@Entity
@Table(name = "contas_receber")
public class ContaReceberEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "empresa_id", nullable = false, updatable = false) private EmpresaEntity empresa;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cliente_id", nullable = false) private ClienteEntity cliente;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "venda_id", updatable = false) private VendaEntity venda;
    @Column(nullable = false, length = 200) private String descricao;
    @Column(nullable = false, precision = 19, scale = 2) private BigDecimal valorOriginal;
    @Column(nullable = false, precision = 19, scale = 2) private BigDecimal valorRecebido = new BigDecimal("0.00");
    private LocalDate dataEmissao;
    @Column(nullable = false) private LocalDate dataVencimento;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private StatusContaReceber status = StatusContaReceber.PENDENTE;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20, updatable = false) private OrigemContaReceber origem = OrigemContaReceber.MANUAL;
    @Column(nullable = false) private int numeroParcela = 1;
    @Column(nullable = false) private int totalParcelas = 1;
    @Column(length = 1000) private String observacao;
    @Column(nullable = false, updatable = false) private LocalDateTime dataCriacao;
    @Column(nullable = false) private LocalDateTime dataAtualizacao;

    protected ContaReceberEntity() { }
    public ContaReceberEntity(EmpresaEntity empresa) {
        this.empresa = empresa;
        this.dataCriacao = LocalDateTime.now().truncatedTo(ChronoUnit.MICROS);
        this.dataAtualizacao = dataCriacao;
    }
    public static ContaReceberEntity daVenda(VendaEntity venda, BigDecimal valor, LocalDate vencimento,
            int numero, int total) {
        var conta = new ContaReceberEntity(venda.getEmpresa());
        conta.venda = venda;
        conta.origem = OrigemContaReceber.VENDA_A_PRAZO;
        conta.editar(venda.getCliente(), "Venda #" + venda.getId() + " - parcela " + numero + "/" + total,
                valor, LocalDate.now(), vencimento, numero, total, null);
        return conta;
    }
    public void editar(ClienteEntity cliente, String descricao, BigDecimal valor, LocalDate emissao,
            LocalDate vencimento, int numeroParcela, int totalParcelas, String observacao) {
        this.cliente = cliente;
        this.descricao = descricao;
        this.valorOriginal = valor;
        this.dataEmissao = emissao;
        this.dataVencimento = vencimento;
        this.numeroParcela = numeroParcela;
        this.totalParcelas = totalParcelas;
        this.observacao = observacao;
        atualizarData();
    }
    public void aplicarRecebimento(BigDecimal diferenca) {
        var novoValor = valorRecebido.add(diferenca);
        if (status == StatusContaReceber.CANCELADA || novoValor.signum() < 0 || novoValor.compareTo(valorOriginal) > 0)
            throw new IllegalStateException("Acumulado de recebimentos invalido.");
        valorRecebido = novoValor;
        status = novoValor.signum() == 0 ? StatusContaReceber.PENDENTE
                : novoValor.compareTo(valorOriginal) == 0 ? StatusContaReceber.RECEBIDA : StatusContaReceber.PARCIAL;
        atualizarData();
    }
    public void cancelar() { status = StatusContaReceber.CANCELADA; atualizarData(); }
    private void atualizarData() { dataAtualizacao = LocalDateTime.now().truncatedTo(ChronoUnit.MICROS); }
    public Long getId() { return id; }
    public EmpresaEntity getEmpresa() { return empresa; }
    public ClienteEntity getCliente() { return cliente; }
    public VendaEntity getVenda() { return venda; }
    public String getDescricao() { return descricao; }
    public BigDecimal getValorOriginal() { return valorOriginal; }
    public BigDecimal getValorRecebido() { return valorRecebido; }
    public BigDecimal getSaldo() { return valorOriginal.subtract(valorRecebido); }
    public LocalDate getDataEmissao() { return dataEmissao; }
    public LocalDate getDataVencimento() { return dataVencimento; }
    public StatusContaReceber getStatus() { return status; }
    public OrigemContaReceber getOrigem() { return origem; }
    public int getNumeroParcela() { return numeroParcela; }
    public int getTotalParcelas() { return totalParcelas; }
    public String getObservacao() { return observacao; }
    public LocalDateTime getDataCriacao() { return dataCriacao; }
    public LocalDateTime getDataAtualizacao() { return dataAtualizacao; }
}
