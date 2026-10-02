package br.com.novexa.erp.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "entradas_mercadoria")
public class EntradaMercadoriaEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "empresa_id", nullable = false, updatable = false) private EmpresaEntity empresa;
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "fornecedor_id", nullable = false) private FornecedorEntity fornecedor;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private OrigemEntradaMercadoria origem = OrigemEntradaMercadoria.MANUAL;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private StatusEntradaMercadoria status = StatusEntradaMercadoria.RASCUNHO;
    @Column(length = 60) private String numeroNota;
    @Column(length = 20) private String serie;
    @Column(length = 44) private String chaveAcessoNfe;
    private LocalDate dataEmissao;
    @Column(nullable = false) private LocalDate dataEntrada;
    @Column(nullable = false, precision = 19, scale = 2) private BigDecimal valorProdutos;
    @Column(nullable = false, precision = 19, scale = 2) private BigDecimal valorTotal;
    @Column(length = 2000) private String observacao;
    @Column(nullable = false, updatable = false) private LocalDateTime dataCadastro;
    @Column(nullable = false) private LocalDateTime dataAtualizacao;
    @Column(nullable = false, updatable = false) private Long usuarioCadastroId;
    private Long usuarioConfirmacaoId;
    private Long usuarioCancelamentoId;
    private LocalDateTime dataConfirmacao;
    private LocalDateTime dataCancelamento;
    @Column(updatable = false) private UUID chaveRequisicao;
    @Column(length = 64, updatable = false) private String resumoRequisicao;
    @OneToMany(mappedBy = "entrada", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("ordem ASC") private List<ItemEntradaMercadoriaEntity> itens = new ArrayList<>();

    @PrePersist void criarDatas() { dataCadastro = LocalDateTime.now(); dataAtualizacao = dataCadastro; }
    @PreUpdate void atualizarData() { dataAtualizacao = LocalDateTime.now(); }
    public Long getId() { return id; }
    public EmpresaEntity getEmpresa() { return empresa; }
    public void setEmpresa(EmpresaEntity v) { empresa = v; }
    public FornecedorEntity getFornecedor() { return fornecedor; }
    public void setFornecedor(FornecedorEntity v) { fornecedor = v; }
    public OrigemEntradaMercadoria getOrigem() { return origem; }
    public void setOrigem(OrigemEntradaMercadoria v) { origem = v; }
    public StatusEntradaMercadoria getStatus() { return status; }
    public String getNumeroNota() { return numeroNota; }
    public void setNumeroNota(String v) { numeroNota = v; }
    public String getSerie() { return serie; }
    public void setSerie(String v) { serie = v; }
    public String getChaveAcessoNfe() { return chaveAcessoNfe; }
    public void setChaveAcessoNfe(String v) { chaveAcessoNfe = v; }
    public LocalDate getDataEmissao() { return dataEmissao; }
    public void setDataEmissao(LocalDate v) { dataEmissao = v; }
    public LocalDate getDataEntrada() { return dataEntrada; }
    public void setDataEntrada(LocalDate v) { dataEntrada = v; }
    public BigDecimal getValorProdutos() { return valorProdutos; }
    public void setValorProdutos(BigDecimal v) { valorProdutos = v; }
    public BigDecimal getValorTotal() { return valorTotal; }
    public void setValorTotal(BigDecimal v) { valorTotal = v; }
    public String getObservacao() { return observacao; }
    public void setObservacao(String v) { observacao = v; }
    public LocalDateTime getDataCadastro() { return dataCadastro; }
    public LocalDateTime getDataAtualizacao() { return dataAtualizacao; }
    public Long getUsuarioCadastroId() { return usuarioCadastroId; }
    public void setUsuarioCadastroId(Long v) { usuarioCadastroId = v; }
    public Long getUsuarioConfirmacaoId() { return usuarioConfirmacaoId; }
    public Long getUsuarioCancelamentoId() { return usuarioCancelamentoId; }
    public LocalDateTime getDataConfirmacao() { return dataConfirmacao; }
    public LocalDateTime getDataCancelamento() { return dataCancelamento; }
    public UUID getChaveRequisicao() { return chaveRequisicao; }
    public void setChaveRequisicao(UUID v) { chaveRequisicao = v; }
    public String getResumoRequisicao() { return resumoRequisicao; }
    public void setResumoRequisicao(String v) { resumoRequisicao = v; }
    public List<ItemEntradaMercadoriaEntity> getItens() { return itens; }
    public void registrarEdicao() { dataAtualizacao = LocalDateTime.now(); }
    public void confirmar(Long usuarioId) {
        status = StatusEntradaMercadoria.CONFIRMADA; usuarioConfirmacaoId = usuarioId; dataConfirmacao = LocalDateTime.now();
    }
    public void cancelar(Long usuarioId) {
        status = StatusEntradaMercadoria.CANCELADA; usuarioCancelamentoId = usuarioId; dataCancelamento = LocalDateTime.now();
    }
}
