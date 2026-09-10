package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.TipoPessoa;

import java.time.LocalDateTime;

public class ClienteResponseDTO {

    private Long id;
    private Long empresaId;
    private String nome;
    private TipoPessoa tipoPessoa;
    private String cpfCnpj;
    private String email;
    private String telefone;
    private String endereco;
    private Boolean ativo;
    private LocalDateTime dataCadastro;

    public ClienteResponseDTO() {
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
    private String nomeFantasia;

    private String inscricaoEstadual;

    private String vendedor;

    private String condicaoPagamento;

    private java.math.BigDecimal limiteCredito;

    private String observacoesInternas;

    private String instrucoesEntrega;

    private java.util.List<br.com.novexa.erp.entity.ClienteEndereco> enderecos = new java.util.ArrayList<>();

    public java.util.List<br.com.novexa.erp.entity.ClienteEndereco> getEnderecos() { return enderecos; }
    public void setEnderecos(java.util.List<br.com.novexa.erp.entity.ClienteEndereco> valor) { this.enderecos = valor; }

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
