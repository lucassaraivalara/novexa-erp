package br.com.novexa.erp.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

@Entity
@Table(name = "contas_financeiras")
public class ContaFinanceiraEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false) @JoinColumn(name = "empresa_id", nullable = false, updatable = false)
    private EmpresaEntity empresa;
    @Column(nullable = false, length = 150) private String nome;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private TipoContaFinanceira tipo;
    @Column(nullable = false, precision = 19, scale = 2, updatable = false) private BigDecimal saldoInicial;
    @Column(nullable = false, precision = 19, scale = 2) private BigDecimal saldoAtual;
    @Column(nullable = false) private boolean ativo;
    @Column(nullable = false, updatable = false) private LocalDateTime dataCriacao;
    @Column(nullable = false) private LocalDateTime dataAtualizacao;

    protected ContaFinanceiraEntity() { }
    public ContaFinanceiraEntity(EmpresaEntity empresa, String nome, TipoContaFinanceira tipo, BigDecimal saldoInicial) {
        this.empresa = empresa;
        this.nome = nome;
        this.tipo = tipo;
        this.saldoInicial = saldoInicial;
        this.saldoAtual = saldoInicial;
        this.ativo = true;
        this.dataCriacao = LocalDateTime.now().truncatedTo(ChronoUnit.MICROS);
        this.dataAtualizacao = dataCriacao;
    }

    public void editar(String nome, TipoContaFinanceira tipo) {
        this.nome = nome;
        this.tipo = tipo;
        atualizarData();
    }
    public void situacao(boolean ativo) { this.ativo = ativo; atualizarData(); }
    public void aplicar(BigDecimal diferenca) { this.saldoAtual = saldoAtual.add(diferenca); atualizarData(); }
    private void atualizarData() { dataAtualizacao = LocalDateTime.now().truncatedTo(ChronoUnit.MICROS); }
    public Long getId() { return id; }
    public EmpresaEntity getEmpresa() { return empresa; }
    public String getNome() { return nome; }
    public TipoContaFinanceira getTipo() { return tipo; }
    public BigDecimal getSaldoInicial() { return saldoInicial; }
    public BigDecimal getSaldoAtual() { return saldoAtual; }
    public boolean isAtivo() { return ativo; }
    public LocalDateTime getDataCriacao() { return dataCriacao; }
    public LocalDateTime getDataAtualizacao() { return dataAtualizacao; }
}
