package br.com.novexa.erp.dto;

import java.time.LocalDateTime;

public class FornecedorResponseDTO {

    private Long id;
    private Long empresaId;
    private String razaoSocial;
    private String nomeFantasia;
    private String cpfCnpj;
    private String inscricaoEstadual;
    private String email;
    private String telefone;
    private String endereco;
    private Boolean ativo;
    private LocalDateTime dataCadastro;
    private br.com.novexa.erp.entity.TipoPessoa tipoPessoa;
    private String cep;
    private String logradouro;
    private String numero;
    private String complemento;
    private String bairro;
    private String cidade;
    private String uf;
    private String observacao;
    private LocalDateTime dataAtualizacao;

    public br.com.novexa.erp.entity.TipoPessoa getTipoPessoa() { return tipoPessoa; }
    public void setTipoPessoa(br.com.novexa.erp.entity.TipoPessoa valor) { tipoPessoa = valor; }
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
    public void setDataAtualizacao(LocalDateTime valor) { dataAtualizacao = valor; }

    public FornecedorResponseDTO() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getEmpresaId() {
        return empresaId;
    }

    public void setEmpresaId(Long empresaId) {
        this.empresaId = empresaId;
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
