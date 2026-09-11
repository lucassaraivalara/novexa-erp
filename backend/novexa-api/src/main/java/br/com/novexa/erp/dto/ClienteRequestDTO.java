package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.TipoPessoa;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class ClienteRequestDTO {

    @NotBlank(message = "O nome do cliente é obrigatório.")
    @Size(max = 150, message = "O nome do cliente deve ter no máximo 150 caracteres.")
    private String nome;

    @NotNull(message = "O tipo de pessoa é obrigatório.")
    private TipoPessoa tipoPessoa;

    @Size(max = 18, message = "CPF ou CNPJ deve ter no máximo 18 caracteres.")
    private String cpfCnpj;

    @Email(message = "Informe um e-mail válido.")
    @Size(max = 150, message = "O e-mail deve ter no máximo 150 caracteres.")
    private String email;

    @Size(max = 30, message = "O telefone deve ter no máximo 30 caracteres.")
    private String telefone;

    @Size(max = 255, message = "O endereço deve ter no máximo 255 caracteres.")
    private String endereco;

    private Boolean ativo;

    public ClienteRequestDTO() {
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
    @Size(max = 150)
    private String nomeFantasia;

    @Size(max = 30)
    private String inscricaoEstadual;

    @Size(max = 150)
    private String vendedor;

    @Size(max = 150)
    private String condicaoPagamento;

    @jakarta.validation.constraints.DecimalMin(value = "0.00", message = "Limite de crédito não pode ser negativo.")
    @jakarta.validation.constraints.Digits(integer = 13, fraction = 2)
    private java.math.BigDecimal limiteCredito;

    @Size(max = 4000)
    private String observacoesInternas;

    @Size(max = 2000)
    private String instrucoesEntrega;

    @jakarta.validation.Valid
    @Size(max = 100)
    private java.util.List<br.com.novexa.erp.entity.ClienteEndereco> enderecos = new java.util.ArrayList<>();

    public java.util.List<br.com.novexa.erp.entity.ClienteEndereco> getEnderecos() { return enderecos; }
    public void setEnderecos(java.util.List<br.com.novexa.erp.entity.ClienteEndereco> valor) { this.enderecos = valor; }

    @jakarta.validation.Valid
    @Size(max = 100)
    private java.util.List<br.com.novexa.erp.entity.ClienteContato> contatos = new java.util.ArrayList<>();

    public java.util.List<br.com.novexa.erp.entity.ClienteContato> getContatos() { return contatos; }
    public void setContatos(java.util.List<br.com.novexa.erp.entity.ClienteContato> valor) { this.contatos = valor; }

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
