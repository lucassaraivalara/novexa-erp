package br.com.novexa.erp.dto;

/**
 * DTO utilizado para devolver os dados da empresa
 * nas respostas da API.
 *
 * Diferente do EmpresaRequestDTO, que representa
 * os dados recebidos pela API, o ResponseDTO representa
 * os dados que serão enviados de volta para o cliente.
 */
public class EmpresaResponseDTO {

    private Long id;
    private String razaoSocial;
    private String nomeFantasia;
    private String cnpj;
    private String inscricaoEstadual;
    private String email;
    private String telefone;
    private String endereco;
    private Boolean ativo;

    /*
     * Construtor vazio.
     *
     * Necessário para que o objeto possa ser criado
     * e preenchido posteriormente através dos setters.
     */
    public EmpresaResponseDTO() {
    }

    // Getter e Setter do ID

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    // Getter e Setter da razão social

    public String getRazaoSocial() {
        return razaoSocial;
    }

    public void setRazaoSocial(String razaoSocial) {
        this.razaoSocial = razaoSocial;
    }

    // Getter e Setter do nome fantasia

    public String getNomeFantasia() {
        return nomeFantasia;
    }

    public void setNomeFantasia(String nomeFantasia) {
        this.nomeFantasia = nomeFantasia;
    }

    // Getter e Setter do CNPJ

    public String getCnpj() {
        return cnpj;
    }

    public void setCnpj(String cnpj) {
        this.cnpj = cnpj;
    }

    // Getter e Setter da inscrição estadual

    public String getInscricaoEstadual() {
        return inscricaoEstadual;
    }

    public void setInscricaoEstadual(String inscricaoEstadual) {
        this.inscricaoEstadual = inscricaoEstadual;
    }

    // Getter e Setter do e-mail

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    // Getter e Setter do telefone

    public String getTelefone() {
        return telefone;
    }

    public void setTelefone(String telefone) {
        this.telefone = telefone;
    }

    // Getter e Setter do endereço

    public String getEndereco() {
        return endereco;
    }

    public void setEndereco(String endereco) {
        this.endereco = endereco;
    }

    // Getter e Setter do status ativo

    public Boolean getAtivo() {
        return ativo;
    }

    public void setAtivo(Boolean ativo) {
        this.ativo = ativo;
    }
}