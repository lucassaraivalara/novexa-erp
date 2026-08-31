package br.com.novexa.erp.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "usuario")
public class UsuarioEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nomeUsuario;

    private String cpf;

    private String email;

    // A senha é armazenada como hash BCrypt, nunca em texto puro.
    private String senha;

    // Novos usuários já nascem ativos.
    // Registros antigos podem ficar nulos até a próxima atualização do banco.
    private Boolean ativo = true;

    /*
     * Cada usuário trabalha em uma empresa. A coluna permanece nullable nesta
     * primeira evolução para que registros legados possam ser vinculados sem
     * impedir a atualização automática do schema. A camada de serviço exige
     * empresa para novos cadastros e bloqueia o login sem esse vínculo.
     */
    @ManyToOne
    @JoinColumn(
            name = "empresa_id",
            foreignKey = @ForeignKey(name = "fk_usuario_empresa")
    )
    private EmpresaEntity empresa;

    public UsuarioEntity() {
    }

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

    public Boolean getAtivo() {
        return ativo;
    }

    public void setAtivo(Boolean ativo) {
        this.ativo = ativo;
    }

    public EmpresaEntity getEmpresa() {
        return empresa;
    }

    public void setEmpresa(EmpresaEntity empresa) {
        this.empresa = empresa;
    }
}
