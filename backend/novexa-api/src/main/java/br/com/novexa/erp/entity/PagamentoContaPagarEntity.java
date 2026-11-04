package br.com.novexa.erp.entity;

import br.com.novexa.erp.time.TempoNovexa;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Entity
@Table(name="pagamentos_conta_pagar")
public class PagamentoContaPagarEntity {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="empresa_id",updatable=false) private EmpresaEntity empresa;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="conta_pagar_id",updatable=false) private ContaPagarEntity contaPagar;
    @Column(updatable=false,nullable=false) private UUID chaveRequisicao;
    @Column(updatable=false,nullable=false,length=64) private String resumoRequisicao;
    @Column(updatable=false,nullable=false) private LocalDate dataPagamento;
    @Column(updatable=false,nullable=false,precision=19,scale=2) private BigDecimal valorOriginal;
    @Column(updatable=false,nullable=false,precision=19,scale=2) private BigDecimal principalQuitado;
    @Column(updatable=false,nullable=false,precision=19,scale=2) private BigDecimal juros;
    @Column(updatable=false,nullable=false,precision=19,scale=2) private BigDecimal multa;
    @Column(updatable=false,nullable=false,precision=19,scale=2) private BigDecimal desconto;
    @Column(updatable=false,nullable=false,precision=19,scale=2) private BigDecimal totalPago;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="usuario_id",updatable=false) private UsuarioEntity usuario;
    @Column(updatable=false,nullable=false) private LocalDateTime dataCriacao;
    @Column(nullable=false,length=16) private String estado;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="usuario_estorno_id") private UsuarioEntity usuarioEstorno;
    private LocalDateTime dataEstorno;
    @Column(length=500) private String motivoEstorno;

    protected PagamentoContaPagarEntity() { }
    public PagamentoContaPagarEntity(ContaPagarEntity conta, UsuarioEntity usuario, UUID chave, String resumo,
            LocalDate data, BigDecimal juros, BigDecimal multa, BigDecimal desconto, BigDecimal total) {
        this.empresa=conta.getEmpresa(); this.contaPagar=conta; this.usuario=usuario;
        this.chaveRequisicao=chave; this.resumoRequisicao=resumo; this.dataPagamento=data;
        this.valorOriginal=conta.getValor(); this.principalQuitado=conta.getValor();
        this.juros=juros; this.multa=multa; this.desconto=desconto; this.totalPago=total;
        this.dataCriacao=TempoNovexa.agora().truncatedTo(ChronoUnit.MICROS); this.estado="CONFIRMADO";
    }
    public void estornar(UsuarioEntity usuario,String motivo) {
        estado="ESTORNADO"; usuarioEstorno=usuario; motivoEstorno=motivo;
        dataEstorno=TempoNovexa.agora().truncatedTo(ChronoUnit.MICROS);
    }
    public Long getId(){return id;}
    public EmpresaEntity getEmpresa(){return empresa;}
    public ContaPagarEntity getContaPagar(){return contaPagar;}
    public UUID getChaveRequisicao(){return chaveRequisicao;}
    public String getResumoRequisicao(){return resumoRequisicao;}
    public LocalDate getDataPagamento(){return dataPagamento;}
    public BigDecimal getValorOriginal(){return valorOriginal;}
    public BigDecimal getPrincipalQuitado(){return principalQuitado;}
    public BigDecimal getJuros(){return juros;}
    public BigDecimal getMulta(){return multa;}
    public BigDecimal getDesconto(){return desconto;}
    public BigDecimal getTotalPago(){return totalPago;}
    public UsuarioEntity getUsuario(){return usuario;}
    public LocalDateTime getDataCriacao(){return dataCriacao;}
    public String getEstado(){return estado;}
    public UsuarioEntity getUsuarioEstorno(){return usuarioEstorno;}
    public LocalDateTime getDataEstorno(){return dataEstorno;}
    public String getMotivoEstorno(){return motivoEstorno;}
}
