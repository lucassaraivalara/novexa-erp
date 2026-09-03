package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.PerfilUsuario;

// Retorna somente os dados necessários para identificar o usuário no frontend.
public class LoginResponseDTO {

    private Long id;
    private String nomeUsuario;
    private String cpf;
    private String email;
    private PerfilUsuario perfil;
    private EmpresaResponseDTO empresa;

    public LoginResponseDTO() {
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

    public PerfilUsuario getPerfil() {
        return perfil;
    }

    public void setPerfil(PerfilUsuario perfil) {
        this.perfil = perfil;
    }

    public EmpresaResponseDTO getEmpresa() {
        return empresa;
    }

    public void setEmpresa(EmpresaResponseDTO empresa) {
        this.empresa = empresa;
    }
}
