package br.com.novexa.erp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "clientes",
        indexes = {
                @Index(name = "idx_cliente_empresa", columnList = "empresa_id"),
                @Index(name = "idx_cliente_empresa_cpf_cnpj", columnList = "empresa_id, cpf_cnpj")
        }
)
public class ClienteEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(
            name = "empresa_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "fk_cliente_empresa")
    )
    private EmpresaEntity empresa;

    @Column(nullable = false)
    private String nome;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_pessoa", nullable = false, length = 10)
    private TipoPessoa tipoPessoa;

    @Column(name = "cpf_cnpj", length = 14)
    private String cpfCnpj;

    private String email;
    private String telefone;
    private String endereco;

    @Column(nullable = false)
    private Boolean ativo = true;

    @Column(name = "data_cadastro", nullable = false, updatable = false)
    private LocalDateTime dataCadastro;

    public ClienteEntity() {
    }

    @PrePersist
    private void preencherDadosIniciais() {
        if (ativo == null) {
            ativo = true;
        }

        if (dataCadastro == null) {
            dataCadastro = LocalDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public EmpresaEntity getEmpresa() {
        return empresa;
    }

    public void setEmpresa(EmpresaEntity empresa) {
        this.empresa = empresa;
    }

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public TipoPessoa getTipoPessoa() {
        return tipoPessoa;
    }

    public void setTipoPessoa(TipoPessoa tipoPessoa) {
        this.tipoPessoa = tipoPessoa;
    }

    public String getCpfCnpj() {
        return cpfCnpj;
    }

    public void setCpfCnpj(String cpfCnpj) {
        this.cpfCnpj = cpfCnpj;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getTelefone() {
        return telefone;
    }

    public void setTelefone(String telefone) {
        this.telefone = telefone;
    }

    public String getEndereco() {
        return endereco;
    }

    public void setEndereco(String endereco) {
        this.endereco = endereco;
    }

    public Boolean getAtivo() {
        return ativo;
    }

    public void setAtivo(Boolean ativo) {
        this.ativo = ativo;
    }

    public LocalDateTime getDataCadastro() {
        return dataCadastro;
    }

    public void setDataCadastro(LocalDateTime dataCadastro) {
        this.dataCadastro = dataCadastro;
    }
    @Column(length = 150)
    private String nomeFantasia;

    @Column(length = 30)
    private String inscricaoEstadual;

    @Column(length = 150)
    private String vendedor;

    @Column(length = 150)
    private String condicaoPagamento;

    @Column(precision = 15, scale = 2)
    private java.math.BigDecimal limiteCredito;

    @Column(length = 4000)
    private String observacoesInternas;

    @Column(length = 2000)
    private String instrucoesEntrega;

    @jakarta.persistence.ElementCollection
    @jakarta.persistence.CollectionTable(name = "cliente_enderecos", joinColumns = @JoinColumn(name = "cliente_id"))
    @jakarta.persistence.OrderColumn(name = "ordem")
    private java.util.List<br.com.novexa.erp.entity.ClienteEndereco> enderecos = new java.util.ArrayList<>();

    public java.util.List<br.com.novexa.erp.entity.ClienteEndereco> getEnderecos() { return enderecos; }
    public void setEnderecos(java.util.List<br.com.novexa.erp.entity.ClienteEndereco> valor) { this.enderecos.clear(); if (valor != null) this.enderecos.addAll(valor); }

    @jakarta.persistence.ElementCollection
    @jakarta.persistence.CollectionTable(name = "cliente_contatos", joinColumns = @JoinColumn(name = "cliente_id"))
    @jakarta.persistence.OrderColumn(name = "ordem")
    private java.util.List<br.com.novexa.erp.entity.ClienteContato> contatos = new java.util.ArrayList<>();

    public java.util.List<br.com.novexa.erp.entity.ClienteContato> getContatos() { return contatos; }
    public void setContatos(java.util.List<br.com.novexa.erp.entity.ClienteContato> valor) { this.contatos.clear(); if (valor != null) this.contatos.addAll(valor); }

    public String getNomeFantasia() { return nomeFantasia; }
    public void setNomeFantasia(String nomeFantasia) { this.nomeFantasia = nomeFantasia; }
    public String getInscricaoEstadual() { return inscricaoEstadual; }
    public void setInscricaoEstadual(String inscricaoEstadual) { this.inscricaoEstadual = inscricaoEstadual; }
    public String getVendedor() { return vendedor; }
    public void setVendedor(String vendedor) { this.vendedor = vendedor; }
    public String getCondicaoPagamento() { return condicaoPagamento; }
    public void setCondicaoPagamento(String condicaoPagamento) { this.condicaoPagamento = condicaoPagamento; }
    public java.math.BigDecimal getLimiteCredito() { return limiteCredito; }
    public void setLimiteCredito(java.math.BigDecimal limiteCredito) { this.limiteCredito = limiteCredito; }
    public String getObservacoesInternas() { return observacoesInternas; }
    public void setObservacoesInternas(String observacoesInternas) { this.observacoesInternas = observacoesInternas; }
    public String getInstrucoesEntrega() { return instrucoesEntrega; }
    public void setInstrucoesEntrega(String instrucoesEntrega) { this.instrucoesEntrega = instrucoesEntrega; }
}
