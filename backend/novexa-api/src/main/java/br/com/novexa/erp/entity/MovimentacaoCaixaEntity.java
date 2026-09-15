package br.com.novexa.erp.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "movimentacoes_caixa", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"sessao_id", "chave_requisicao"}),
        @UniqueConstraint(columnNames = {"pagamento_id", "tipo"})})
public class MovimentacaoCaixaEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false) @JoinColumn(nullable = false, updatable = false) private EmpresaEntity empresa;
    @ManyToOne(optional = false) @JoinColumn(nullable = false, updatable = false) private SessaoCaixaEntity sessao;
    @ManyToOne(optional = false) @JoinColumn(nullable = false, updatable = false) private UsuarioEntity usuario;
    @ManyToOne @JoinColumn(updatable = false) private PagamentoEntity pagamento;
    @Column(nullable = false, updatable = false) private UUID chaveRequisicao;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20, updatable = false) private TipoMovimentacaoCaixa tipo;
    @Column(nullable = false, precision = 19, scale = 2, updatable = false) private BigDecimal valor;
    @Column(length = 500, updatable = false) private String observacao;
    @Column(nullable = false, updatable = false) private LocalDateTime dataHora;

    protected MovimentacaoCaixaEntity() { }
    public MovimentacaoCaixaEntity(SessaoCaixaEntity sessao, UsuarioEntity usuario, PagamentoEntity pagamento,
            UUID chave, TipoMovimentacaoCaixa tipo, BigDecimal valor, String observacao) {
        this.empresa = sessao.getEmpresa(); this.sessao = sessao; this.usuario = usuario;
        this.pagamento = pagamento; this.chaveRequisicao = chave; this.tipo = tipo;
        this.valor = valor; this.observacao = observacao; this.dataHora = LocalDateTime.now();
    }
    public Long getId() { return id; }
    public SessaoCaixaEntity getSessao() { return sessao; }
    public UsuarioEntity getUsuario() { return usuario; }
    public PagamentoEntity getPagamento() { return pagamento; }
    public UUID getChaveRequisicao() { return chaveRequisicao; }
    public TipoMovimentacaoCaixa getTipo() { return tipo; }
    public BigDecimal getValor() { return valor; }
    public String getObservacao() { return observacao; }
    public LocalDateTime getDataHora() { return dataHora; }
}
