package br.com.novexa.erp.dto;

import jakarta.validation.constraints.NotBlank;

// DTO exclusivo para receber as credenciais do login.
public class LoginRequestDTO {

    @NotBlank(message = "CPF é obrigatório.")
    private String cpf;

    @NotBlank(message = "Senha é obrigatória.")
    private String senha;

    public LoginRequestDTO() {
    }

    public String getCpf() {
        return cpf;
    }

    public void setCpf(String cpf) {
        this.cpf = cpf;
    }

    public String getSenha() {
        return senha;
    }

    public void setSenha(String senha) {
        this.senha = senha;
    }
}
