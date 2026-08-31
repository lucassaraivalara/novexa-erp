package br.com.novexa.erp.dto;

public class UsuarioResponseDTO {

    private Long id;
    private String nomeUsuario;
    private String cpf;
    private String email;
    private EmpresaResponseDTO empresa;

    // =========================================================
    // CONSTRUTOR
    // =========================================================

    // Construtor vazio.
    public UsuarioResponseDTO() {
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

    public EmpresaResponseDTO getEmpresa() {
        return empresa;
    }

    public void setEmpresa(EmpresaResponseDTO empresa) {
        this.empresa = empresa;
    }
}
