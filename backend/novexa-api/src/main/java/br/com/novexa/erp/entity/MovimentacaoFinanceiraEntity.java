package br.com.novexa.erp.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

@Entity
@Table(name = "movimentacoes_financeiras")
public class MovimentacaoFinanceiraEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false) @JoinColumn(name = "empresa_id", nullable = false, updatable = false)
    private EmpresaEntity empresa;
    @ManyToOne(optional = false) @JoinColumn(name = "conta_financeira_id", nullable = false, updatable = false)
    private ContaFinanceiraEntity contaFinanceira;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 10, updatable = false)
    private TipoMovimentacaoFinanceira tipo;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20, updatable = false)
    private OrigemMovimentacaoFinanceira origem;
    @Column(nullable = false, length = 200, updatable = false) private String descricao;
    @Column(nullable = false, precision = 19, scale = 2, updatable = false) private BigDecimal valor;
    @Column(nullable = false, updatable = false) private LocalDate dataMovimento;
    @Column(length = 1000, updatable = false) private String observacao;
    @ManyToOne(optional = false) @JoinColumn(name = "usuario_id", nullable = false, updatable = false)
    private UsuarioEntity usuario;
    @Column(nullable = false, updatable = false) private LocalDateTime dataCriacao;
    @Column(nullable = false) private boolean estornada;
    private LocalDateTime dataEstorno;
    @ManyToOne @JoinColumn(name = "usuario_estorno_id") private UsuarioEntity usuarioEstorno;
    @Column(length = 500) private String motivoEstorno;

    protected MovimentacaoFinanceiraEntity() { }
    public MovimentacaoFinanceiraEntity(ContaFinanceiraEntity conta, TipoMovimentacaoFinanceira tipo,
            String descricao, BigDecimal valor, LocalDate dataMovimento, String observacao, UsuarioEntity usuario) {
        this(conta, tipo, OrigemMovimentacaoFinanceira.MANUAL, descricao, valor, dataMovimento, observacao, usuario);
    }
    public MovimentacaoFinanceiraEntity(ContaFinanceiraEntity conta, TipoMovimentacaoFinanceira tipo,
            OrigemMovimentacaoFinanceira origem, String descricao, BigDecimal valor, LocalDate dataMovimento,
            String observacao, UsuarioEntity usuario) {
        this.empresa = conta.getEmpresa();
        this.contaFinanceira = conta;
        this.tipo = tipo;
        this.origem = origem;
        this.descricao = descricao;
        this.valor = valor;
        this.dataMovimento = dataMovimento;
        this.observacao = observacao;
        this.usuario = usuario;
        this.dataCriacao = LocalDateTime.now().truncatedTo(ChronoUnit.MICROS);
    }
    public void estornar(UsuarioEntity usuario, String motivo) {
        this.estornada = true;
        this.dataEstorno = LocalDateTime.now().truncatedTo(ChronoUnit.MICROS);
        this.usuarioEstorno = usuario;
        this.motivoEstorno = motivo;
    }
    public Long getId() { return id; }
    public EmpresaEntity getEmpresa() { return empresa; }
    public ContaFinanceiraEntity getContaFinanceira() { return contaFinanceira; }
    public TipoMovimentacaoFinanceira getTipo() { return tipo; }
    public OrigemMovimentacaoFinanceira getOrigem() { return origem; }
    public String getDescricao() { return descricao; }
    public BigDecimal getValor() { return valor; }
    public LocalDate getDataMovimento() { return dataMovimento; }
    public String getObservacao() { return observacao; }
    public UsuarioEntity getUsuario() { return usuario; }
    public LocalDateTime getDataCriacao() { return dataCriacao; }
    public boolean isEstornada() { return estornada; }
    public LocalDateTime getDataEstorno() { return dataEstorno; }
    public UsuarioEntity getUsuarioEstorno() { return usuarioEstorno; }
    public String getMotivoEstorno() { return motivoEstorno; }
}
