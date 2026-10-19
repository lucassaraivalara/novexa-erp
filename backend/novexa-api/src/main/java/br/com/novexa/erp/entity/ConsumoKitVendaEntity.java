package br.com.novexa.erp.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity @Table(name="consumos_kit_venda")
public class ConsumoKitVendaEntity {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
    @Column(nullable=false) public Long empresaId;
    @Column(nullable=false) public Long vendaId;
    @ManyToOne(optional=false) @JoinColumn(name="item_id") public ItemVendaEntity item;
    @Column(nullable=false) public Long composicaoId;
    @ManyToOne(optional=false) @JoinColumn(name="componente_id") public ProdutoEntity componente;
    @Column(length=150) public String nome;
    @Column(length=10) public String unidade;
    @Column(precision=19,scale=3) public BigDecimal quantidade;
    @Column(precision=19,scale=2) public BigDecimal custoUnitario;
    @Column(nullable=false) public Long movimentoId;
    public Long reversaoId;
}
