package br.com.novexa.erp.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "usuario")
public class UsuarioEntity {

    // Identificador único do usuário.
    // O banco de dados gera esse valor automaticamente.
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Nome do usuário no sistema.
    private String nomeUsuario;

    // CPF do usuário.
    private String cpf;

    // E-mail do usuário.
    private String email;

    // Senha do usuário.
    private String senha;

    // =========================================================
    // CONSTRUTOR
    // =========================================================

    // Construtor vazio utilizado pelo JPA.
    public UsuarioEntity() {
    }

    // =========================================================
    // GETTERS E SETTERS
    // =========================================================

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

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