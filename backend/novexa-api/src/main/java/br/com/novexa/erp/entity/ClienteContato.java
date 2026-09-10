package br.com.novexa.erp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.validation.constraints.*;

@Embeddable
public class ClienteContato {
    @NotBlank
    @Size(max = 150)
    @Column(length = 150)
    private String nome;
    @Size(max = 100)
    @Column(length = 100)
    private String cargo;
    @Size(max = 30)
    @Column(length = 30)
    private String telefone;
    @Email
    @Size(max = 150)
    @Column(length = 150)
    private String email;
    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome = nome; }
    public String getCargo() { return cargo; }
    public void setCargo(String cargo) { this.cargo = cargo; }
    public String getTelefone() { return telefone; }
    public void setTelefone(String telefone) { this.telefone = telefone; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
}
