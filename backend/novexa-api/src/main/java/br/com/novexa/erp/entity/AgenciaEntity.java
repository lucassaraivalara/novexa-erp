package br.com.novexa.erp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
        name = "agencias",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_agencia_banco_numero",
                columnNames = {"banco_id", "numero"}
        )
)
public class AgenciaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "banco_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "fk_agencia_banco")
    )
    private BancoEntity banco;

    @Column(nullable = false, length = 20)
    private String numero;

    @Column(length = 5)
    private String digito;

    @Column(length = 150)
    private String contato;

    @Column(length = 20)
    private String telefone;

    @Column(length = 120)
    private String cidade;

    @Column(nullable = false)
    private boolean ativo;

    protected AgenciaEntity() {
    }

    public AgenciaEntity(
            BancoEntity banco,
            String numero,
            String digito,
            String contato,
            String telefone,
            String cidade,
            boolean ativo) {
        this.banco = banco;
        this.numero = numero;
        this.digito = digito;
        this.contato = contato;
        this.telefone = telefone;
        this.cidade = cidade;
        this.ativo = ativo;
    }

    public Long getId() {
        return id;
    }

    public BancoEntity getBanco() {
        return banco;
    }

    public String getNumero() {
        return numero;
    }

    public String getDigito() {
        return digito;
    }

    public String getContato() {
        return contato;
    }

    public String getTelefone() {
        return telefone;
    }

    public String getCidade() {
        return cidade;
    }

    public boolean isAtivo() {
        return ativo;
    }

    public void atualizar(
            BancoEntity banco,
            String numero,
            String digito,
            String contato,
            String telefone,
            String cidade,
            boolean ativo) {
        this.banco = banco;
        this.numero = numero;
        this.digito = digito;
        this.contato = contato;
        this.telefone = telefone;
        this.cidade = cidade;
        this.ativo = ativo;
    }
}
