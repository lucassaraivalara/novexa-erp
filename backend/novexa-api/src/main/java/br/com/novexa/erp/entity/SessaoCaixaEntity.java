package br.com.novexa.erp.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "sessoes_caixa")
public class SessaoCaixaEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(optional = false) @JoinColumn(name = "caixa_id", nullable = false, updatable = false)
    private CaixaEntity caixa;
    @ManyToOne(optional = false) @JoinColumn(name = "empresa_id", nullable = false, updatable = false)
    private EmpresaEntity empresa;
    @ManyToOne(optional = false) @JoinColumn(name = "usuario_abertura_id", nullable = false, updatable = false)
    private UsuarioEntity usuarioAbertura;
    @ManyToOne @JoinColumn(name = "usuario_fechamento_id")
    private UsuarioEntity usuarioFechamento;
    @Column(name = "saldo_inicial", nullable = false, precision = 19, scale = 2, updatable = false)
    private BigDecimal saldoInicial;
    @Column(name = "saldo_final", precision = 19, scale = 2)
    private BigDecimal saldoFinal;
    @Column(name = "data_abertura", nullable = false, updatable = false)
    private LocalDateTime dataAbertura;
    @Column(name = "data_fechamento")
    private LocalDateTime dataFechamento;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 10)
    private StatusSessaoCaixa status;

    protected SessaoCaixaEntity() {}
    public SessaoCaixaEntity(CaixaEntity caixa, UsuarioEntity usuario, BigDecimal saldoInicial) {
        this.caixa = caixa;
        this.empresa = caixa.getEmpresa();
        this.usuarioAbertura = usuario;
        this.saldoInicial = saldoInicial;
        this.dataAbertura = LocalDateTime.now();
        this.status = StatusSessaoCaixa.ABERTO;
    }

    public void fechar(UsuarioEntity usuario, BigDecimal saldoFinal) {
        if (status != StatusSessaoCaixa.ABERTO) throw new IllegalStateException("Sessão já fechada.");
        this.usuarioFechamento = usuario;
        this.saldoFinal = saldoFinal;
        this.dataFechamento = LocalDateTime.now();
        this.status = StatusSessaoCaixa.FECHADO;
    }

    public Long getId() { return id; }
    public CaixaEntity getCaixa() { return caixa; }
    public EmpresaEntity getEmpresa() { return empresa; }
    public UsuarioEntity getUsuarioAbertura() { return usuarioAbertura; }
    public UsuarioEntity getUsuarioFechamento() { return usuarioFechamento; }
    public BigDecimal getSaldoInicial() { return saldoInicial; }
    public BigDecimal getSaldoFinal() { return saldoFinal; }
    public LocalDateTime getDataAbertura() { return dataAbertura; }
    public LocalDateTime getDataFechamento() { return dataFechamento; }
    public StatusSessaoCaixa getStatus() { return status; }
}
