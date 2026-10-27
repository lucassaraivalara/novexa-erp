package br.com.novexa.erp.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.util.ArrayList;
import java.util.List;

@org.hibernate.annotations.DynamicUpdate
@Entity
@Table(name = "empresas")
public class EmpresaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @jakarta.persistence.Enumerated(jakarta.persistence.EnumType.STRING)
    @jakarta.persistence.Column(nullable = false, length = 20)
    private ModoRecebimentoFinanceiro modoRecebimentoFinanceiro = ModoRecebimentoFinanceiro.CONTROLADO;
    @jakarta.persistence.Enumerated(jakarta.persistence.EnumType.STRING)
    @jakarta.persistence.Column(nullable = false, length = 30)
    private ModoConferenciaFechamento modoConferenciaFechamento = ModoConferenciaFechamento.POR_FORMA_PAGAMENTO;
    @jakarta.persistence.Column(nullable = false)
    private boolean exigirValoresInformadosNoFechamento = true;
    public ModoRecebimentoFinanceiro getModoRecebimentoFinanceiro() { return modoRecebimentoFinanceiro; }
    public ModoConferenciaFechamento getModoConferenciaFechamento() { return modoConferenciaFechamento; }
    public boolean isExigirValoresInformadosNoFechamento() { return exigirValoresInformadosNoFechamento; }
    public void configurarRecebimentos(ModoRecebimentoFinanceiro modo, ModoConferenciaFechamento conferencia, boolean exigir) {
        modoRecebimentoFinanceiro = java.util.Objects.requireNonNull(modo);
        modoConferenciaFechamento = java.util.Objects.requireNonNull(conferencia);
        exigirValoresInformadosNoFechamento = exigir;
    }


    private String razaoSocial;

    private String nomeFantasia;

    @jakarta.persistence.Column(unique = true)
    private String cnpj;

    private String inscricaoEstadual;

    private String email;

    private String telefone;

    private String endereco;

    private Boolean ativo;

    @jakarta.persistence.Column(nullable = false)
    private Boolean permitirVendaEstoqueNegativo = false;

    @jakarta.persistence.Column(nullable = false)
    @org.hibernate.annotations.ColumnDefault("true")
    private Boolean controlaEstoque = true;
    public Boolean getControlaEstoque() { return controlaEstoque; }
    public void setControlaEstoque(Boolean valor) { controlaEstoque = valor; }


    public Boolean getPermitirVendaEstoqueNegativo() { return permitirVendaEstoqueNegativo; }
    public void setPermitirVendaEstoqueNegativo(Boolean valor) { permitirVendaEstoqueNegativo = valor; }

    @jakarta.persistence.Embedded
    private EmpresaCadastroDados cadastro = new EmpresaCadastroDados();

    @jakarta.persistence.Column(columnDefinition = "text")
    private String logomarca;

    @OneToMany(mappedBy = "empresa", cascade = jakarta.persistence.CascadeType.ALL, orphanRemoval = true)
    @jakarta.persistence.OrderBy("uf ASC")
    private List<EmpresaInscricaoSt> inscricoesSt = new ArrayList<>();

    public EmpresaCadastroDados getCadastro() { return cadastro; }
    public void setCadastro(EmpresaCadastroDados valor) { cadastro = valor; }
    public String getLogomarca() { return logomarca; }
    public void setLogomarca(String valor) { logomarca = valor; }
    public List<EmpresaInscricaoSt> getInscricoesSt() { return inscricoesSt; }

    @OneToMany(mappedBy = "empresa")
    private List<UsuarioEntity> usuarios = new ArrayList<>();

    public EmpresaEntity() {
    }

    // =========================
    // GETTERS
    // =========================

    public Long getId() {
        return id;
    }

    public String getRazaoSocial() {
        return razaoSocial;
    }

    public String getNomeFantasia() {
        return nomeFantasia;
    }

    public String getCnpj() {
        return cnpj;
    }

    public String getInscricaoEstadual() {
        return inscricaoEstadual;
    }

    public String getEmail() {
        return email;
    }

    public String getTelefone() {
        return telefone;
    }

    public String getEndereco() {
        return endereco;
    }

    public Boolean getAtivo() {
        return ativo;
    }

    public List<UsuarioEntity> getUsuarios() {
        return usuarios;
    }


    // =========================
    // SETTERS
    // =========================

    public void setId(Long id) {
        this.id = id;
    }

    public void setRazaoSocial(String razaoSocial) {
        this.razaoSocial = razaoSocial;
    }

    public void setNomeFantasia(String nomeFantasia) {
        this.nomeFantasia = nomeFantasia;
    }

    public void setCnpj(String cnpj) {
        this.cnpj = cnpj;
    }

    public void setInscricaoEstadual(String inscricaoEstadual) {
        this.inscricaoEstadual = inscricaoEstadual;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public void setTelefone(String telefone) {
        this.telefone = telefone;
    }

    public void setEndereco(String endereco) {
        this.endereco = endereco;
    }

    public void setAtivo(Boolean ativo) {
        this.ativo = ativo;
    }

    public void setUsuarios(List<UsuarioEntity> usuarios) {
        this.usuarios = usuarios;
    }

}
