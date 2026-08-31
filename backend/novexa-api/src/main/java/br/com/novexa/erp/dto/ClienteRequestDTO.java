package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.TipoPessoa;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class ClienteRequestDTO {

    @NotNull(message = "A empresa é obrigatória.")
    private Long empresaId;

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
}
