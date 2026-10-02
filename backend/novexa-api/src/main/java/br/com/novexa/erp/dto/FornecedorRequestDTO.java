package br.com.novexa.erp.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class FornecedorRequestDTO {

    @NotBlank(message = "A razão social é obrigatória.")
    @Size(max = 150, message = "A razão social deve ter no máximo 150 caracteres.")
    @com.fasterxml.jackson.annotation.JsonAlias("nomeRazaoSocial")
    private String razaoSocial;

    @Size(max = 150, message = "O nome fantasia deve ter no máximo 150 caracteres.")
    private String nomeFantasia;

    @Size(max = 40, message = "CPF ou CNPJ deve ter no máximo 40 caracteres.")
    private String cpfCnpj;

    @Size(max = 30, message = "A inscrição estadual deve ter no máximo 30 caracteres.")
    private String inscricaoEstadual;

    @Email(message = "Informe um e-mail válido.")
    @Size(max = 150, message = "O e-mail deve ter no máximo 150 caracteres.")
    private String email;

    @Size(max = 30, message = "O telefone deve ter no máximo 30 caracteres.")
    private String telefone;

    @Size(max = 255, message = "O endereço deve ter no máximo 255 caracteres.")
    private String endereco;

    private Boolean ativo;

    @Size(max = 9) private String cep;
    @Size(max = 150) private String logradouro;
    @Size(max = 20) private String numero;
    @Size(max = 100) private String complemento;
    @Size(max = 100) private String bairro;
    @Size(max = 100) private String cidade;
    @jakarta.validation.constraints.Pattern(regexp = "[a-zA-Z]{2}|\\s*", message = "Informe uma UF com duas letras.")
    private String uf;
    @Size(max = 2000) private String observacao;

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

    public FornecedorRequestDTO() {
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
}
