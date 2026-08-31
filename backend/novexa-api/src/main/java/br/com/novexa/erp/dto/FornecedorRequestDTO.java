package br.com.novexa.erp.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class FornecedorRequestDTO {

    @NotNull(message = "A empresa é obrigatória.")
    private Long empresaId;

    @NotBlank(message = "A razão social é obrigatória.")
    @Size(max = 150, message = "A razão social deve ter no máximo 150 caracteres.")
    private String razaoSocial;

    @Size(max = 150, message = "O nome fantasia deve ter no máximo 150 caracteres.")
    private String nomeFantasia;

    @Size(max = 18, message = "CPF ou CNPJ deve ter no máximo 18 caracteres.")
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

    public FornecedorRequestDTO() {
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
}
