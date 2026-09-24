package br.com.novexa.erp.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "conferencias_fechamento_caixa")
public class ConferenciaFechamentoCaixaEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false) @JoinColumn(nullable = false, updatable = false) private EmpresaEntity empresa;
    @ManyToOne(optional = false) @JoinColumn(nullable = false, updatable = false) private SessaoCaixaEntity sessao;
    @ManyToOne @JoinColumn(name = "forma_pagamento_id", updatable = false) private FormaPagamentoEntity forma;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20, updatable = false) private EscopoConferenciaCaixa escopo;
    @Column(nullable = false, length = 150, updatable = false) private String descricaoSnapshot;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20, updatable = false) private TipoFormaPagamento tipoSnapshot;
    @Column(nullable = false, precision = 19, scale = 2, updatable = false) private BigDecimal valorEsperado;
    @Column(nullable = false, precision = 19, scale = 2, updatable = false) private BigDecimal valorInformado;

    protected ConferenciaFechamentoCaixaEntity() { }

    public ConferenciaFechamentoCaixaEntity(SessaoCaixaEntity sessao, FormaPagamentoEntity forma,
            String descricao, TipoFormaPagamento tipo, BigDecimal esperado, BigDecimal informado) {
        this.sessao = sessao;
        this.empresa = sessao.getEmpresa();
        this.forma = forma;
        this.escopo = forma == null ? EscopoConferenciaCaixa.DINHEIRO_FISICO : EscopoConferenciaCaixa.FORMA_PAGAMENTO;
        this.descricaoSnapshot = descricao;
        this.tipoSnapshot = tipo;
        this.valorEsperado = esperado.setScale(2);
        this.valorInformado = informado.setScale(2);
    }

    public Long getId() { return id; }
    public EmpresaEntity getEmpresa() { return empresa; }
    public FormaPagamentoEntity getForma() { return forma; }
    public EscopoConferenciaCaixa getEscopo() { return escopo; }
    public String getDescricaoSnapshot() { return descricaoSnapshot; }
    public TipoFormaPagamento getTipoSnapshot() { return tipoSnapshot; }
    public BigDecimal getValorEsperado() { return valorEsperado; }
    public BigDecimal getValorInformado() { return valorInformado; }
    public BigDecimal getDiferenca() { return valorInformado.subtract(valorEsperado); }
}
