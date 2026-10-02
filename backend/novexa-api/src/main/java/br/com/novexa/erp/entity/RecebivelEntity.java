package br.com.novexa.erp.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "recebiveis", uniqueConstraints = @UniqueConstraint(name = "uk_recebivel_parcela",
        columnNames = {"empresa_id", "pagamento_id", "numero_parcela"}))
public class RecebivelEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(nullable = false, updatable = false) private EmpresaEntity empresa;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(nullable = false, updatable = false) private PagamentoEntity pagamento;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(nullable = false, updatable = false) private VendaEntity venda;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20, updatable = false) private TipoFormaPagamento tipo;
    @Column(nullable = false, updatable = false) private int numeroParcela;
    @Column(nullable = false, updatable = false) private int totalParcelas;
    @Column(nullable = false, precision = 19, scale = 2, updatable = false) private BigDecimal valorBruto;
    @Column(precision = 19, scale = 2, updatable = false) private BigDecimal valorLiquidoPrevisto;
    @Column(nullable = false, updatable = false) private LocalDateTime dataVenda;
    @Column(updatable = false) private LocalDate dataPrevistaRecebimento;
    @Column(precision = 7, scale = 4, updatable = false) private BigDecimal taxaPercentualSnapshot;
    @Column(precision = 19, scale = 2, updatable = false) private BigDecimal taxaFixaSnapshot;
    @Column(precision = 19, scale = 2, updatable = false) private BigDecimal valorTaxasPrevisto;
    @Column(updatable = false) private Integer prazoRecebimentoDiasSnapshot;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private StatusRecebivel status;
    @Column(nullable = false, updatable = false) private LocalDateTime criadoEm;
    @Column(updatable = false) private Long configuracaoFormaPagamentoId;
    @Column(length = 150, updatable = false) private String configuracaoNomeExibicao;
    @Enumerated(EnumType.STRING) @Column(length = 20, updatable = false) private TipoFormaPagamento configuracaoTipo;
    private LocalDateTime dataLiquidacao;
    @Column(precision = 19, scale = 2) private BigDecimal valorLiquidoRecebido;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "usuario_liquidacao_id") private UsuarioEntity usuarioLiquidacao;
    private LocalDateTime dataCancelamento;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "usuario_cancelamento_id") private UsuarioEntity usuarioCancelamento;

    protected RecebivelEntity() { }

    public RecebivelEntity(PagamentoEntity pagamento) {
        this.tipo = pagamento.getFormaPagamento() == FormaPagamento.CARTAO_DEBITO ? TipoFormaPagamento.DEBITO
                : pagamento.getFormaPagamento() == FormaPagamento.CARTAO_CREDITO ? TipoFormaPagamento.CREDITO : null;
        if (tipo == null || pagamento.getStatus() != StatusPagamento.REGISTRADO || pagamento.getValor().signum() <= 0)
            throw new IllegalArgumentException("Recebivel exige pagamento de cartao registrado com valor positivo.");
        this.empresa = pagamento.getEmpresa();
        this.pagamento = pagamento;
        this.venda = pagamento.getVenda();
        this.numeroParcela = 1;
        this.totalParcelas = 1;
        this.valorBruto = pagamento.getValor();
        this.taxaPercentualSnapshot = pagamento.getTaxaPercentualSnapshot() == null ? BigDecimal.ZERO : pagamento.getTaxaPercentualSnapshot();
        this.taxaFixaSnapshot = pagamento.getTaxaFixaSnapshot() == null ? BigDecimal.ZERO : pagamento.getTaxaFixaSnapshot();
        this.prazoRecebimentoDiasSnapshot = pagamento.getPrazoRecebimentoDiasSnapshot() == null ? 0 : pagamento.getPrazoRecebimentoDiasSnapshot();
        this.valorTaxasPrevisto = valorBruto.multiply(taxaPercentualSnapshot).movePointLeft(2)
                .setScale(2, RoundingMode.HALF_UP).add(taxaFixaSnapshot).setScale(2, RoundingMode.UNNECESSARY);
        this.valorLiquidoPrevisto = valorBruto.subtract(valorTaxasPrevisto);
        if (valorLiquidoPrevisto.signum() <= 0)
            throw new IllegalArgumentException("Taxas devem resultar em valor liquido positivo para esta venda.");
        // Momento do faturamento, nao da abertura da venda.
        this.dataVenda = pagamento.getDataHora();
        this.dataPrevistaRecebimento = dataVenda.toLocalDate().plusDays(prazoRecebimentoDiasSnapshot);
        this.status = StatusRecebivel.PENDENTE;
        this.criadoEm = LocalDateTime.now();
        var configuracao = pagamento.getConfiguracaoFormaPagamento();
        this.configuracaoFormaPagamentoId = configuracao == null ? null : configuracao.getId();
        this.configuracaoNomeExibicao = pagamento.getConfiguracaoNomeExibicao();
        this.configuracaoTipo = pagamento.getConfiguracaoTipo();
    }

    public void liquidar(MovimentacaoFinanceiraEntity movimento) {
        if (status != StatusRecebivel.PENDENTE || movimento.getRecebivel() != this || movimento.isEstornada())
            throw new IllegalStateException("Liquidacao incompativel com o recebivel.");
        status = StatusRecebivel.LIQUIDADO;
        dataLiquidacao = movimento.getDataCriacao();
        valorLiquidoRecebido = movimento.getValor();
        usuarioLiquidacao = movimento.getUsuario();
    }

    public void cancelar(UsuarioEntity usuario) {
        if (status == StatusRecebivel.CANCELADO) return;
        status = StatusRecebivel.CANCELADO;
        dataCancelamento = LocalDateTime.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        usuarioCancelamento = usuario;
    }
    public LocalDateTime getDataLiquidacao() { return dataLiquidacao; }
    public BigDecimal getValorLiquidoRecebido() { return valorLiquidoRecebido; }
    public UsuarioEntity getUsuarioLiquidacao() { return usuarioLiquidacao; }
    public LocalDateTime getDataCancelamento() { return dataCancelamento; }
    public UsuarioEntity getUsuarioCancelamento() { return usuarioCancelamento; }
    public Long getId() { return id; }
    public EmpresaEntity getEmpresa() { return empresa; }
    public PagamentoEntity getPagamento() { return pagamento; }
    public VendaEntity getVenda() { return venda; }
    public TipoFormaPagamento getTipo() { return tipo; }
    public int getNumeroParcela() { return numeroParcela; }
    public int getTotalParcelas() { return totalParcelas; }
    public BigDecimal getValorBruto() { return valorBruto; }
    public BigDecimal getTaxaPercentualSnapshot() { return taxaPercentualSnapshot; }
    public BigDecimal getTaxaFixaSnapshot() { return taxaFixaSnapshot; }
    public BigDecimal getValorTaxasPrevisto() { return valorTaxasPrevisto; }
    public Integer getPrazoRecebimentoDiasSnapshot() { return prazoRecebimentoDiasSnapshot; }
    public BigDecimal getValorLiquidoPrevisto() { return valorLiquidoPrevisto; }
    public LocalDateTime getDataVenda() { return dataVenda; }
    public LocalDate getDataPrevistaRecebimento() { return dataPrevistaRecebimento; }
    public StatusRecebivel getStatus() { return status; }
    public LocalDateTime getCriadoEm() { return criadoEm; }
    public Long getConfiguracaoFormaPagamentoId() { return configuracaoFormaPagamentoId; }
    public String getConfiguracaoNomeExibicao() { return configuracaoNomeExibicao; }
    public TipoFormaPagamento getConfiguracaoTipo() { return configuracaoTipo; }
}
