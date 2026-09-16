package br.com.novexa.erp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "contas_bancarias")
public class ContaBancariaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "empresa_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "fk_conta_bancaria_empresa")
    )
    private EmpresaEntity empresa;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "agencia_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "fk_conta_bancaria_agencia")
    )
    private AgenciaEntity agencia;

    @Column(nullable = false, length = 20)
    private String numero;

    @Column(length = 5)
    private String digito;

    @Column(length = 150)
    private String titular;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TipoContaBancaria tipo;

    @Column(nullable = false)
    private boolean ativo;

    protected ContaBancariaEntity() {
    }

    public ContaBancariaEntity(
            EmpresaEntity empresa,
            AgenciaEntity agencia,
            String numero,
            String digito,
            String titular,
            TipoContaBancaria tipo,
            boolean ativo) {
        this.empresa = empresa;
        this.agencia = agencia;
        this.numero = numero;
        this.digito = digito;
        this.titular = titular;
        this.tipo = tipo;
        this.ativo = ativo;
    }

    public Long getId() {
        return id;
    }

    public EmpresaEntity getEmpresa() {
        return empresa;
    }

    public AgenciaEntity getAgencia() {
        return agencia;
    }

    public String getNumero() {
        return numero;
    }

    public String getDigito() {
        return digito;
    }

    public String getTitular() {
        return titular;
    }

    public TipoContaBancaria getTipo() {
        return tipo;
    }

    public boolean isAtivo() {
        return ativo;
    }

    public void atualizar(
            AgenciaEntity agencia,
            String numero,
            String digito,
            String titular,
            TipoContaBancaria tipo,
            boolean ativo) {
        this.agencia = agencia;
        this.numero = numero;
        this.digito = digito;
        this.titular = titular;
        this.tipo = tipo;
        this.ativo = ativo;
    }
}
