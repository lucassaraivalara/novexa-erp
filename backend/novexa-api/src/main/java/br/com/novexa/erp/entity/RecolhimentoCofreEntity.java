package br.com.novexa.erp.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Vinculo auditavel; saldo e fonte de verdade continuam na ContaFinanceira. */
@Entity @Table(name = "recolhimentos_cofre")
public class RecolhimentoCofreEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
    @ManyToOne(optional = false) @JoinColumn(name = "empresa_id", nullable = false) public EmpresaEntity empresa;
    @ManyToOne(optional = false) @JoinColumn(name = "sessao_id", nullable = false) public SessaoCaixaEntity sessao;
    @ManyToOne @JoinColumn(name = "conta_id") public ContaFinanceiraEntity conta;
    @OneToOne @JoinColumn(name = "movimento_caixa_id") public MovimentacaoCaixaEntity movimentoCaixa;
    @OneToOne @JoinColumn(name = "movimento_financeiro_id") public MovimentacaoFinanceiraEntity movimentoFinanceiro;
    @ManyToOne(optional = false) @JoinColumn(name = "usuario_id", nullable = false) public UsuarioEntity usuario;
    @ManyToOne @JoinColumn(name = "usuario_confirmacao_id") public UsuarioEntity usuarioConfirmacao;
    @Column(nullable = false, length = 20) public String tipo;
    @Column(nullable = false) public UUID chaveRequisicao;
    @Column(nullable = false, precision = 19, scale = 2) public BigDecimal valor;
    @Column(nullable = false, precision = 19, scale = 2) public BigDecimal valorTroco;
    @Column(length = 150) public String responsavel;
    @Column(length = 500) public String observacao;
    @Column(nullable = false) public LocalDateTime dataCriacao;
    public LocalDateTime dataConfirmacao;
}
