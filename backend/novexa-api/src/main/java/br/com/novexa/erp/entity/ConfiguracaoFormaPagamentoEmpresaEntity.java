package br.com.novexa.erp.entity;

import br.com.novexa.erp.time.TempoNovexa;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

@Entity
@Table(name = "configuracoes_formas_pagamento_empresa")
public class ConfiguracaoFormaPagamentoEmpresaEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "empresa_id", nullable = false, updatable = false) private EmpresaEntity empresa;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "forma_pagamento_id", nullable = false, updatable = false) private FormaPagamentoEntity formaPagamento;
    // Derivado do catálogo; a FK composta da V24 garante a coerência do CHECK de destino.
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20, updatable = false)
    private TipoFormaPagamento tipo;
    @Column(nullable = false, length = 150) private String nomeExibicao;
    @org.hibernate.annotations.GeneratedColumn("lower(trim(nome_exibicao))")
    @Column(nullable = false, length = 150, insertable = false, updatable = false)
    private String nomeNormalizado;
    @Column(nullable = false) private boolean ativo;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conta_financeira_destino_id") private ContaFinanceiraEntity contaFinanceiraDestino;
    @Column(nullable = false, updatable = false) private LocalDateTime dataCriacao;
    @Column(nullable = false) private LocalDateTime dataAtualizacao;
    @Column(precision = 7, scale = 4) private BigDecimal taxaPercentual;
    @Column(precision = 19, scale = 2) private BigDecimal taxaFixa;
    private Integer prazoRecebimentoDias;
    private Integer maximoParcelasConsumidor;

    protected ConfiguracaoFormaPagamentoEmpresaEntity() { }
    public ConfiguracaoFormaPagamentoEmpresaEntity(EmpresaEntity empresa, FormaPagamentoEntity forma,
            String nome, boolean ativo, ContaFinanceiraEntity destino) {
        this.empresa = empresa;
        this.formaPagamento = forma;
        this.tipo = forma.getTipo();
        this.maximoParcelasConsumidor = tipo == TipoFormaPagamento.CREDITO ? 1 : null;
        this.dataCriacao = TempoNovexa.agora().truncatedTo(ChronoUnit.MICROS);
        atualizar(nome, ativo, destino);
    }
    public void atualizar(String nome, boolean ativo, ContaFinanceiraEntity destino) {
        this.nomeExibicao = nome;
        this.ativo = ativo;
        this.contaFinanceiraDestino = destino;
        this.dataAtualizacao = TempoNovexa.agora().truncatedTo(ChronoUnit.MICROS);
    }
    public Long getId() { return id; }
    public void atualizarCondicoesCartao(BigDecimal percentual, BigDecimal fixa, Integer prazo) {
        atualizarCondicoesCartao(percentual, fixa, prazo, this.maximoParcelasConsumidor);
    }
    public void atualizarCondicoesCartao(BigDecimal percentual, BigDecimal fixa, Integer prazo, Integer maximoParcelas) {
        if (tipo != TipoFormaPagamento.DEBITO && tipo != TipoFormaPagamento.CREDITO)
            throw new IllegalArgumentException("Condicoes financeiras exclusivas de cartao.");
        if (maximoParcelas != null && (maximoParcelas < 1 || maximoParcelas > 12))
            throw new IllegalArgumentException("Maximo de parcelas do consumidor invalido.");
        if (tipo != TipoFormaPagamento.CREDITO && maximoParcelas != null)
            throw new IllegalArgumentException("Parcelas do consumidor exclusivas de credito.");
        if (percentual == null || percentual.signum() < 0 || percentual.compareTo(new BigDecimal("100")) > 0
                || fixa == null || fixa.signum() < 0 || prazo == null || prazo < 0)
            throw new IllegalArgumentException("Taxas ou prazo de cartao invalidos.");
        this.taxaPercentual = percentual.setScale(4, java.math.RoundingMode.UNNECESSARY);
        this.taxaFixa = fixa.setScale(2, java.math.RoundingMode.UNNECESSARY);
        this.prazoRecebimentoDias = prazo;
        this.maximoParcelasConsumidor = tipo == TipoFormaPagamento.CREDITO ? maximoParcelas : null;
    }
    public Integer getMaximoParcelasConsumidor() { return maximoParcelasConsumidor; }
    public BigDecimal getTaxaPercentual() { return taxaPercentual; }
    public BigDecimal getTaxaFixa() { return taxaFixa; }
    public Integer getPrazoRecebimentoDias() { return prazoRecebimentoDias; }
    public EmpresaEntity getEmpresa() { return empresa; }
    public FormaPagamentoEntity getFormaPagamento() { return formaPagamento; }
    public TipoFormaPagamento getTipo() { return tipo; }
    public String getNomeExibicao() { return nomeExibicao; }
    public String getNomeNormalizado() { return nomeNormalizado; }
    public boolean isAtivo() { return ativo; }
    public ContaFinanceiraEntity getContaFinanceiraDestino() { return contaFinanceiraDestino; }
    public LocalDateTime getDataCriacao() { return dataCriacao; }
    public LocalDateTime getDataAtualizacao() { return dataAtualizacao; }
}
