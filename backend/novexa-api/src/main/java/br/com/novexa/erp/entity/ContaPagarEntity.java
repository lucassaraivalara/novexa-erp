package br.com.novexa.erp.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "contas_pagar")
public class ContaPagarEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "empresa_id", nullable = false) private EmpresaEntity empresa;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fornecedor_id") private FornecedorEntity fornecedor;
    @Column(nullable = false, length = 200) private String descricao;
    @Column(length = 80) private String documento;
    @Column(length = 100) private String categoria;
    private LocalDate dataEmissao;
    @Column(nullable = false) private LocalDate dataVencimento;
    @Column(nullable = false, precision = 19, scale = 2) private BigDecimal valor;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private StatusContaPagar status;
    private LocalDate dataPagamento;
    @Column(precision = 19, scale = 2) private BigDecimal valorPago;
    @Column(length = 1000) private String observacao;

    protected ContaPagarEntity() { }

    public ContaPagarEntity(EmpresaEntity empresa) {
        this.empresa = empresa;
        this.status = StatusContaPagar.ABERTA;
    }

    public void atualizar(String descricao, String documento, FornecedorEntity fornecedor, String categoria,
            LocalDate dataEmissao, LocalDate dataVencimento, BigDecimal valor, String observacao) {
        this.descricao = descricao;
        this.documento = documento;
        this.fornecedor = fornecedor;
        this.categoria = categoria;
        this.dataEmissao = dataEmissao;
        this.dataVencimento = dataVencimento;
        this.valor = valor;
        this.observacao = observacao;
    }

    public void pagar(LocalDate data, BigDecimal valor) {
        status = StatusContaPagar.PAGA;
        dataPagamento = data;
        valorPago = valor;
    }

    public void abrir() {
        status = StatusContaPagar.ABERTA;
        dataPagamento = null;
        valorPago = null;
    }

    public void cancelar() { status = StatusContaPagar.CANCELADA; }
    public Long getId() { return id; }
    public EmpresaEntity getEmpresa() { return empresa; }
    public FornecedorEntity getFornecedor() { return fornecedor; }
    public String getDescricao() { return descricao; }
    public String getDocumento() { return documento; }
    public String getCategoria() { return categoria; }
    public LocalDate getDataEmissao() { return dataEmissao; }
    public LocalDate getDataVencimento() { return dataVencimento; }
    public BigDecimal getValor() { return valor; }
    public StatusContaPagar getStatus() { return status; }
    public LocalDate getDataPagamento() { return dataPagamento; }
    public BigDecimal getValorPago() { return valorPago; }
    public String getObservacao() { return observacao; }
}
