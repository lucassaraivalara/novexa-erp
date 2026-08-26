package br.com.novexa.erp.dto;

public class UsuarioRequestDTO {

    private String nomeUsuario;
    private String cpf;
    private String email;
    private String senha;

    // =========================================================
    // CONSTRUTOR
    // =========================================================

    // Construtor vazio.
    // Permite que o Spring/Jackson crie o objeto
    // a partir do JSON recebido.
    public UsuarioRequestDTO() {
    }

    // =========================================================
    // GETTERS E SETTERS
    // =========================================================

    public String getNomeUsuario() {
        return nomeUsuario;
    }

    public void setNomeUsuario(String nomeUsuario) {
        this.nomeUsuario = nomeUsuario;
    }

    public String getCpf() {
        return cpf;
    }

    public void setCpf(String cpf) {
        this.cpf = cpf;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getSenha() {
        return senha;
    }

    public void setSenha(String senha) {
        this.senha = senha;
    }
}