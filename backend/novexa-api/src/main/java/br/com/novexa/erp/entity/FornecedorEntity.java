package br.com.novexa.erp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Enumerated;
import jakarta.persistence.EnumType;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "fornecedores",
        indexes = {
                @Index(name = "idx_fornecedor_empresa", columnList = "empresa_id"),
                @Index(name = "idx_fornecedor_empresa_cpf_cnpj", columnList = "empresa_id, cpf_cnpj")
        }
)
public class FornecedorEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(
            name = "empresa_id",
            nullable = false,
            updatable = false,
            foreignKey = @ForeignKey(name = "fk_fornecedor_empresa")
    )
    private EmpresaEntity empresa;

    @Column(name = "razao_social", nullable = false)
    private String razaoSocial;

    @Column(name = "nome_fantasia")
    private String nomeFantasia;

    @Column(name = "cpf_cnpj", length = 14)
    private String cpfCnpj;

    @Column(name = "inscricao_estadual")
    private String inscricaoEstadual;

    private String email;
    private String telefone;
    private String endereco;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_pessoa", length = 20)
    private TipoPessoa tipoPessoa;
    @Column(length = 8) private String cep;
    @Column(length = 150) private String logradouro;
    @Column(length = 20) private String numero;
    @Column(length = 100) private String complemento;
    @Column(length = 100) private String bairro;
    @Column(length = 100) private String cidade;
    @Column(length = 2) private String uf;
    @Column(length = 2000) private String observacao;
    @Column(name = "data_atualizacao") private LocalDateTime dataAtualizacao;

    @Column(nullable = false)
    private Boolean ativo = true;

    @Column(name = "data_cadastro", nullable = false, updatable = false)
    private LocalDateTime dataCadastro;

    public FornecedorEntity() {
    }

    @PrePersist
    private void preencherDadosIniciais() {
        if (ativo == null) {
            ativo = true;
        }

        if (dataCadastro == null) {
            dataCadastro = LocalDateTime.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        }
        dataAtualizacao = dataCadastro;
    }

    @PreUpdate
    private void atualizarData() {
        dataAtualizacao = LocalDateTime.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
    }

    public TipoPessoa getTipoPessoa() { return tipoPessoa; }
    public void setTipoPessoa(TipoPessoa valor) { tipoPessoa = valor; }
    public String getCep() { return cep; }
    public void setCep(String valor) { cep = valor; }
    public String getLogradouro() { return logradouro; }
    public void setLogradouro(String valor) { logradouro = valor; }
    public String getNumero() { return numero; }
    public void setNumero(String valor) { numero = valor; }
    public String getComplemento() { return complemento; }
    public void setComplemento(String valor) { complemento = valor; }
    public String getBairro() { return bairro; }
    public void setBairro(String valor) { bairro = valor; }
    public String getCidade() { return cidade; }
    public void setCidade(String valor) { cidade = valor; }
    public String getUf() { return uf; }
    public void setUf(String valor) { uf = valor; }
    public String getObservacao() { return observacao; }
    public void setObservacao(String valor) { observacao = valor; }
    public LocalDateTime getDataAtualizacao() { return dataAtualizacao; }

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

    public String getRazaoSocial() {
        return razaoSocial;
    }

    public void setRazaoSocial(String razaoSocial) {
        this.razaoSocial = razaoSocial;
    }

    public String getNomeFantasia() {
        return nomeFantasia;
    }

    public void setNomeFantasia(String nomeFantasia) {
        this.nomeFantasia = nomeFantasia;
    }

    public String getCpfCnpj() {
        return cpfCnpj;
    }

    public void setCpfCnpj(String cpfCnpj) {
        this.cpfCnpj = cpfCnpj;
    }

    public String getInscricaoEstadual() {
        return inscricaoEstadual;
    }

    public void setInscricaoEstadual(String inscricaoEstadual) {
        this.inscricaoEstadual = inscricaoEstadual;
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
}
