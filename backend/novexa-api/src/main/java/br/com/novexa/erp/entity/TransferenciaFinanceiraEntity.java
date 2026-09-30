package br.com.novexa.erp.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Entity
@Table(name = "transferencias_financeiras", uniqueConstraints =
        @UniqueConstraint(name = "uk_transferencia_empresa_chave", columnNames = {"empresa_id", "chave_requisicao"}))
public class TransferenciaFinanceiraEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "empresa_id", nullable = false, updatable = false) private EmpresaEntity empresa;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conta_origem_id", nullable = false, updatable = false) private ContaFinanceiraEntity contaOrigem;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conta_destino_id", nullable = false, updatable = false) private ContaFinanceiraEntity contaDestino;
    @Column(nullable = false, precision = 19, scale = 2, updatable = false) private BigDecimal valor;
    @Column(nullable = false, updatable = false) private LocalDate dataMovimento;
    @Column(length = 1000, updatable = false) private String observacao;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false, updatable = false) private UsuarioEntity usuario;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private StatusTransferenciaFinanceira status;
    @Column(nullable = false, updatable = false) private UUID chaveRequisicao;
    @Column(nullable = false, updatable = false) private LocalDateTime dataCriacao;
    private LocalDateTime dataEstorno;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "usuario_estorno_id") private UsuarioEntity usuarioEstorno;
    @Column(length = 500) private String motivoEstorno;

    protected TransferenciaFinanceiraEntity() { }
    public TransferenciaFinanceiraEntity(ContaFinanceiraEntity origem, ContaFinanceiraEntity destino,
            BigDecimal valor, LocalDate data, String observacao, UsuarioEntity usuario, UUID chave) {
        this.empresa = origem.getEmpresa();
        this.contaOrigem = origem;
        this.contaDestino = destino;
        this.valor = valor;
        this.dataMovimento = data;
        this.observacao = observacao;
        this.usuario = usuario;
        this.chaveRequisicao = chave;
        this.status = StatusTransferenciaFinanceira.CONCLUIDA;
        this.dataCriacao = LocalDateTime.now().truncatedTo(ChronoUnit.MICROS);
    }
    public void estornar(UsuarioEntity usuario, String motivo) {
        status = StatusTransferenciaFinanceira.ESTORNADA;
        dataEstorno = LocalDateTime.now().truncatedTo(ChronoUnit.MICROS);
        usuarioEstorno = usuario;
        motivoEstorno = motivo;
    }
    public Long getId() { return id; }
    public EmpresaEntity getEmpresa() { return empresa; }
    public ContaFinanceiraEntity getContaOrigem() { return contaOrigem; }
    public ContaFinanceiraEntity getContaDestino() { return contaDestino; }
    public BigDecimal getValor() { return valor; }
    public LocalDate getDataMovimento() { return dataMovimento; }
    public String getObservacao() { return observacao; }
    public UsuarioEntity getUsuario() { return usuario; }
    public StatusTransferenciaFinanceira getStatus() { return status; }
    public UUID getChaveRequisicao() { return chaveRequisicao; }
    public LocalDateTime getDataCriacao() { return dataCriacao; }
    public LocalDateTime getDataEstorno() { return dataEstorno; }
    public UsuarioEntity getUsuarioEstorno() { return usuarioEstorno; }
    public String getMotivoEstorno() { return motivoEstorno; }
}
