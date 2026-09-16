package br.com.novexa.erp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
        name = "bancos",
        uniqueConstraints = @UniqueConstraint(name = "uk_banco_numero", columnNames = "numero")
)
public class BancoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 10)
    private String numero;

    @Column(nullable = false, length = 150)
    private String nome;

    @Column(length = 10)
    private String cnab;

    @Column(nullable = false)
    private boolean ativo;

    protected BancoEntity() {
    }

    public BancoEntity(String numero, String nome, String cnab, boolean ativo) {
        this.numero = numero;
        this.nome = nome;
        this.cnab = cnab;
        this.ativo = ativo;
    }

    public Long getId() {
        return id;
    }

    public String getNumero() {
        return numero;
    }

    public String getNome() {
        return nome;
    }

    public String getCnab() {
        return cnab;
    }

    public boolean isAtivo() {
        return ativo;
    }

    public void atualizar(String numero, String nome, String cnab, boolean ativo) {
        this.numero = numero;
        this.nome = nome;
        this.cnab = cnab;
        this.ativo = ativo;
    }
}
