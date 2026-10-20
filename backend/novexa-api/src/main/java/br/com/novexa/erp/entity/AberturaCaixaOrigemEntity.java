package br.com.novexa.erp.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Auditoria da origem do fundo inicial de abertura de caixa fisico.
 * Saldo oficial de dinheiro fisico permanece na SessaoCaixa;
 * Saldo oficial financeiro permanece na ContaFinanceira (COFRE).
 */
@Entity
@Table(name = "aberturas_caixa_origem", uniqueConstraints =
        @UniqueConstraint(name = "uk_abertura_origem_chave", columnNames = {"empresa_id", "chave_requisicao"}))
public class AberturaCaixaOrigemEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "empresa_id", nullable = false)
    private EmpresaEntity empresa;

    @OneToOne(optional = false)
    @JoinColumn(name = "sessao_id", nullable = false, unique = true)
    private SessaoCaixaEntity sessao;

    @Column(name = "caixa_id", nullable = false, updatable = false)
    private Long caixaId;

    @ManyToOne
    @JoinColumn(name = "sessao_origem_troco_id", unique = true)
    private SessaoCaixaEntity sessaoOrigemTroco;

    @ManyToOne
    @JoinColumn(name = "conta_cofre_id")
    private ContaFinanceiraEntity contaCofre;

    @OneToOne
    @JoinColumn(name = "movimento_financeiro_id")
    private MovimentacaoFinanceiraEntity movimentoFinanceiro;

    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private UsuarioEntity usuario;

    @Column(name = "chave_requisicao", nullable = false)
    private UUID chaveRequisicao;

    @Column(name = "valor_troco_herdado", nullable = false, precision = 19, scale = 2)
    private BigDecimal valorTrocoHerdado;

    @Column(name = "valor_retirado_cofre", nullable = false, precision = 19, scale = 2)
    private BigDecimal valorRetiradoCofre;

    @Column(name = "valor_aporte_externo", nullable = false, precision = 19, scale = 2)
    private BigDecimal valorAporteExterno;

    @Column(name = "observacao_aporte", length = 500)
    private String observacaoAporte;

    @Column(name = "data_criacao", nullable = false)
    private LocalDateTime dataCriacao;

    protected AberturaCaixaOrigemEntity() {}

    public AberturaCaixaOrigemEntity(EmpresaEntity empresa, SessaoCaixaEntity sessao,
                                     SessaoCaixaEntity sessaoOrigemTroco, ContaFinanceiraEntity contaCofre,
                                     MovimentacaoFinanceiraEntity movimentoFinanceiro, UsuarioEntity usuario,
                                     UUID chaveRequisicao, BigDecimal valorTrocoHerdado,
                                     BigDecimal valorRetiradoCofre, BigDecimal valorAporteExterno,
                                     String observacaoAporte, LocalDateTime dataCriacao) {
        this.empresa = empresa;
        this.sessao = sessao;
        this.caixaId = sessao.getCaixa().getId();
        this.sessaoOrigemTroco = sessaoOrigemTroco;
        this.contaCofre = contaCofre;
        this.movimentoFinanceiro = movimentoFinanceiro;
        this.usuario = usuario;
        this.chaveRequisicao = chaveRequisicao;
        this.valorTrocoHerdado = valorTrocoHerdado != null ? valorTrocoHerdado : BigDecimal.ZERO;
        this.valorRetiradoCofre = valorRetiradoCofre != null ? valorRetiradoCofre : BigDecimal.ZERO;
        this.valorAporteExterno = valorAporteExterno != null ? valorAporteExterno : BigDecimal.ZERO;
        this.observacaoAporte = observacaoAporte;
        this.dataCriacao = dataCriacao != null ? dataCriacao : LocalDateTime.now();
    }

    public Long getId() { return id; }
    public EmpresaEntity getEmpresa() { return empresa; }
    public SessaoCaixaEntity getSessao() { return sessao; }
    public SessaoCaixaEntity getSessaoOrigemTroco() { return sessaoOrigemTroco; }
    public ContaFinanceiraEntity getContaCofre() { return contaCofre; }
    public MovimentacaoFinanceiraEntity getMovimentoFinanceiro() { return movimentoFinanceiro; }
    public UsuarioEntity getUsuario() { return usuario; }
    public UUID getChaveRequisicao() { return chaveRequisicao; }
    public BigDecimal getValorTrocoHerdado() { return valorTrocoHerdado; }
    public BigDecimal getValorRetiradoCofre() { return valorRetiradoCofre; }
    public BigDecimal getValorAporteExterno() { return valorAporteExterno; }
    public String getObservacaoAporte() { return observacaoAporte; }
    public LocalDateTime getDataCriacao() { return dataCriacao; }
}
