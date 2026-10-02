package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.PerfilUsuario;
import jakarta.validation.constraints.*;

public class UsuarioRequestDTO {

    @NotBlank @Size(max = 255) private String nomeUsuario;
    @NotBlank @Size(max = 18)
    private String cpf;
    @Email @Size(max = 255)
    private String email;
    @Size(max = 30) private String telefone;
    private String senha;
    private PerfilUsuario perfil;
    private Boolean ativo;

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

    public PerfilUsuario getPerfil() {
        return perfil;
    }

    public void setPerfil(PerfilUsuario perfil) {
        this.perfil = perfil;
    }
    public String getTelefone() { return telefone; }
    public void setTelefone(String telefone) { this.telefone = telefone; }

    public Boolean getAtivo() {
        return ativo;
    }

    public void setAtivo(Boolean ativo) {
        this.ativo = ativo;
    }

}
