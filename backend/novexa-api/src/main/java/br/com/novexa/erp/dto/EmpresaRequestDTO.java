package br.com.novexa.erp.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.Valid;
import br.com.novexa.erp.entity.EmpresaCadastroDados;
import java.util.ArrayList;
import java.util.List;

public class EmpresaRequestDTO {

    @com.fasterxml.jackson.annotation.JsonIgnore
    @jakarta.validation.constraints.AssertTrue(message = "Informe o regime tributário.")
    public boolean isRegimeTributarioInformado() {
        return cadastro != null && cadastro.getRegimeTributario() != null;
    }

    @NotBlank(message = "A razão social é obrigatória.")
    @Size(max = 150)
    private String razaoSocial;

    @Size(max = 150)
    private String nomeFantasia;

    @NotBlank(message = "O CNPJ é obrigatório.")
    @Size(max = 18)
    private String cnpj;

    // Campo opcional.
    @Size(max = 30)
    private String inscricaoEstadual;

    // Campo opcional, mas se preenchido precisa
    // possuir um formato de e-mail válido.
    @Email(message = "O e-mail informado é inválido.")
    @Size(max = 150)
    private String email;

    @Size(max = 30)
    private String telefone;

    @Size(max = 255)
    private String endereco;

    @NotNull(message = "O campo ativo é obrigatório.")
    private Boolean ativo;

    @Valid @NotNull(message = "Informe os dados complementares da empresa.")
    private EmpresaCadastroDados cadastro;

    @Size(max = 1400000, message = "A logomarca deve ter até 1 MB.")
    private String logomarca;

    @Valid @NotNull @Size(max = 26)
    private List<@NotNull EmpresaInscricaoStDTO> inscricoesSt = new ArrayList<>();

    public EmpresaCadastroDados getCadastro() { return cadastro; }
    public void setCadastro(EmpresaCadastroDados valor) { cadastro = valor; }
    public String getLogomarca() { return logomarca; }
    public void setLogomarca(String valor) { logomarca = valor; }
    public List<EmpresaInscricaoStDTO> getInscricoesSt() { return inscricoesSt; }
    public void setInscricoesSt(List<EmpresaInscricaoStDTO> valor) { inscricoesSt = valor; }

    public String getRazaoSocial() {
        return razaoSocial;
    }

    public void setRazaoSocial(String razaoSocial) {
        this.razaoSocial = razaoSocial;
    }

    public String getNomeFantasia() {
        return nomeFantasia;
    }

    public void setNomeFantasia(String nomeFantasia) {
        this.nomeFantasia = nomeFantasia;
    }

    public String getCnpj() {
        return cnpj;
    }

    public void setCnpj(String cnpj) {
        this.cnpj = cnpj;
    }

    public String getInscricaoEstadual() {
        return inscricaoEstadual;
    }

    public void setInscricaoEstadual(String inscricaoEstadual) {
        this.inscricaoEstadual = inscricaoEstadual;
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
