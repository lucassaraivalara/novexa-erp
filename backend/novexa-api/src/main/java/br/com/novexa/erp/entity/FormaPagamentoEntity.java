package br.com.novexa.erp.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "formas_pagamento")
public class FormaPagamentoEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, length = 150) private String descricao;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, updatable = false) private TipoFormaPagamento tipo;
    @Column(nullable = false) private boolean ativo;

    protected FormaPagamentoEntity() { }

    public FormaPagamentoEntity(String descricao, TipoFormaPagamento tipo, boolean ativo) {
        this.descricao = descricao;
        this.tipo = tipo;
        this.ativo = ativo;
    }

    public Long getId() { return id; }
    public String getDescricao() { return descricao; }
    public TipoFormaPagamento getTipo() { return tipo; }
    public boolean isAtivo() { return ativo; }
    public void atualizar(String descricao, boolean ativo) {
        this.descricao = descricao;
        this.ativo = ativo;
    }
}
