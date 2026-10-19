package br.com.novexa.erp.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity @Table(name="componentes_produto")
public class ComponenteProdutoEntity {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
    @ManyToOne(optional=false) @JoinColumn(name="empresa_id") public EmpresaEntity empresa;
    @ManyToOne(optional=false) @JoinColumn(name="produto_id") public ProdutoEntity produto;
    public Long versao;
    @ManyToOne(optional=false) @JoinColumn(name="componente_id") public ProdutoEntity componente;
    @Column(precision=19,scale=3) public BigDecimal quantidade;
    @Column(precision=19,scale=6) public BigDecimal fator;
    @Column(length=10) public String unidade;
    @Column(length=10) public String unidadeEstoque;
    @Column(length=150) public String nomeComponente;
    @ManyToOne(optional=false) @JoinColumn(name="usuario_id") public UsuarioEntity usuario;
    public LocalDateTime dataCriacao;
    public BigDecimal consumoUnitario() { return quantidade.multiply(fator).setScale(3,java.math.RoundingMode.UNNECESSARY); }
}
