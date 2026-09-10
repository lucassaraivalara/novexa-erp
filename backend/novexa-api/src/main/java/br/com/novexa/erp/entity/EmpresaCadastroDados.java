package br.com.novexa.erp.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;

/** Dados complementares da empresa, armazenados na própria tabela empresas. */
@Embeddable
public class EmpresaCadastroDados {

    @Column(name = "produtor_rural")
    private Boolean produtorRural = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "regime_tributario", length = 25)
    private RegimeTributario regimeTributario;

    @Column(name = "inscricao_municipal", length = 30)
    @Size(max = 30)
    private String inscricaoMunicipal;

    @Column(name = "cep", length = 8)
    @Size(max = 8)
    @Pattern(regexp = "^$|[0-9]{8}", message = "CEP deve conter 8 dígitos.")
    private String cep;

    @Column(name = "logradouro", length = 150)
    @Size(max = 150)
    private String logradouro;

    @Column(name = "numero", length = 20)
    @Size(max = 20)
    private String numero;

    @Column(name = "complemento", length = 100)
    @Size(max = 100)
    private String complemento;

    @Column(name = "bairro", length = 100)
    @Size(max = 100)
    private String bairro;

    @Column(name = "cidade", length = 100)
    @Size(max = 100)
    private String cidade;

    @Column(name = "uf", length = 2)
    @Size(max = 2)
    @Pattern(regexp = "^$|AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO", message = "Informe uma UF válida.")
    private String uf;

    @Column(precision = 10, scale = 7)
    @DecimalMin("-90") @DecimalMax("90") @Digits(integer = 3, fraction = 7)
    private BigDecimal latitude;

    @Column(precision = 10, scale = 7)
    @DecimalMin("-180") @DecimalMax("180") @Digits(integer = 3, fraction = 7)
    private BigDecimal longitude;

    @Column(name = "suframa", length = 9)
    @Size(max = 9)
    @Pattern(regexp = "^$|[0-9]{9}", message = "SUFRAMA deve conter 9 dígitos.")
    private String suframa;

    @Column(name = "indicador_atividade", length = 1)
    @Size(max = 1)
    @Pattern(regexp = "^$|[01]", message = "Opção fiscal inválida: indicadorAtividade.")
    private String indicadorAtividade;

    @Column(name = "perfil_efd", length = 1)
    @Size(max = 1)
    @Pattern(regexp = "^$|[ABC]", message = "Opção fiscal inválida: perfilEfd.")
    private String perfilEfd;

    @Column(name = "regime_pis_cofins", length = 1)
    @Size(max = 1)
    @Pattern(regexp = "^$|[123]", message = "Opção fiscal inválida: regimePisCofins.")
    private String regimePisCofins;

    @Column(name = "criterio_pis_cofins", length = 1)
    @Size(max = 1)
    @Pattern(regexp = "^$|[129]", message = "Opção fiscal inválida: criterioPisCofins.")
    private String criterioPisCofins;

    @Column(name = "tipo_atividade_pis_cofins", length = 1)
    @Size(max = 1)
    @Pattern(regexp = "^$|[0-49]", message = "Opção fiscal inválida: tipoAtividadePisCofins.")
    private String tipoAtividadePisCofins;

    @Column(name = "dia_vencimento_icms")
    @Min(1) @Max(31)
    private Integer diaVencimentoIcms;

    @Column(name = "codigo_receita_icms", length = 20)
    @Size(max = 20)
    private String codigoReceitaIcms;

    @Column(name = "contador_nome", length = 150)
    @Size(max = 150)
    private String contadorNome;

    @Column(name = "contador_cpf", length = 14)
    @Size(max = 14)
    private String contadorCpf;

    @Column(name = "contador_crc", length = 20)
    @Size(max = 20)
    private String contadorCrc;

    @Column(name = "contador_uf_crc", length = 2)
    @Size(max = 2)
    @Pattern(regexp = "^$|AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO", message = "Informe uma UF válida.")
    private String contadorUfCrc;

    @Column(name = "contador_cnpj_escritorio", length = 18)
    @Size(max = 18)
    private String contadorCnpjEscritorio;

    @Column(name = "contador_razao_social", length = 150)
    @Size(max = 150)
    private String contadorRazaoSocial;

    @Column(name = "contador_telefone", length = 30)
    @Size(max = 30)
    private String contadorTelefone;

    @Column(name = "contador_fax", length = 30)
    @Size(max = 30)
    private String contadorFax;

    @Column(name = "contador_email", length = 150)
    @Size(max = 150)
    @Email(message = "E-mail do contador inválido.")
    private String contadorEmail;

    @Column(name = "contador_cep", length = 8)
    @Size(max = 8)
    @Pattern(regexp = "^$|[0-9]{8}", message = "CEP deve conter 8 dígitos.")
    private String contadorCep;

    @Column(name = "contador_logradouro", length = 150)
    @Size(max = 150)
    private String contadorLogradouro;

    @Column(name = "contador_numero", length = 20)
    @Size(max = 20)
    private String contadorNumero;

    @Column(name = "contador_complemento", length = 100)
    @Size(max = 100)
    private String contadorComplemento;

    @Column(name = "contador_bairro", length = 100)
    @Size(max = 100)
    private String contadorBairro;

    @Column(name = "contador_cidade", length = 100)
    @Size(max = 100)
    private String contadorCidade;

    @Column(name = "contador_uf", length = 2)
    @Size(max = 2)
    @Pattern(regexp = "^$|AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO", message = "Informe uma UF válida.")
    private String contadorUf;

    @Column(name = "contador_codigo_municipio", length = 7)
    @Size(max = 7)
    @Pattern(regexp = "^$|[0-9]{7}", message = "Código do município deve conter 7 dígitos.")
    private String contadorCodigoMunicipio;

    public Boolean getProdutorRural() { return produtorRural; }
    public void setProdutorRural(Boolean valor) { this.produtorRural = valor; }
    public RegimeTributario getRegimeTributario() { return regimeTributario; }
    public void setRegimeTributario(RegimeTributario valor) { this.regimeTributario = valor; }
    public String getInscricaoMunicipal() { return inscricaoMunicipal; }
    public void setInscricaoMunicipal(String valor) { this.inscricaoMunicipal = valor; }
    public String getCep() { return cep; }
    public void setCep(String valor) { this.cep = valor; }
    public String getLogradouro() { return logradouro; }
    public void setLogradouro(String valor) { this.logradouro = valor; }
    public String getNumero() { return numero; }
    public void setNumero(String valor) { this.numero = valor; }
    public String getComplemento() { return complemento; }
    public void setComplemento(String valor) { this.complemento = valor; }
    public String getBairro() { return bairro; }
    public void setBairro(String valor) { this.bairro = valor; }
    public String getCidade() { return cidade; }
    public void setCidade(String valor) { this.cidade = valor; }
    public String getUf() { return uf; }
    public void setUf(String valor) { this.uf = valor; }
    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal valor) { this.latitude = valor; }
    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal valor) { this.longitude = valor; }
    public String getSuframa() { return suframa; }
    public void setSuframa(String valor) { this.suframa = valor; }
    public String getIndicadorAtividade() { return indicadorAtividade; }
    public void setIndicadorAtividade(String valor) { this.indicadorAtividade = valor; }
    public String getPerfilEfd() { return perfilEfd; }
    public void setPerfilEfd(String valor) { this.perfilEfd = valor; }
    public String getRegimePisCofins() { return regimePisCofins; }
    public void setRegimePisCofins(String valor) { this.regimePisCofins = valor; }
    public String getCriterioPisCofins() { return criterioPisCofins; }
    public void setCriterioPisCofins(String valor) { this.criterioPisCofins = valor; }
    public String getTipoAtividadePisCofins() { return tipoAtividadePisCofins; }
    public void setTipoAtividadePisCofins(String valor) { this.tipoAtividadePisCofins = valor; }
    public Integer getDiaVencimentoIcms() { return diaVencimentoIcms; }
    public void setDiaVencimentoIcms(Integer valor) { this.diaVencimentoIcms = valor; }
    public String getCodigoReceitaIcms() { return codigoReceitaIcms; }
    public void setCodigoReceitaIcms(String valor) { this.codigoReceitaIcms = valor; }
    public String getContadorNome() { return contadorNome; }
    public void setContadorNome(String valor) { this.contadorNome = valor; }
    public String getContadorCpf() { return contadorCpf; }
    public void setContadorCpf(String valor) { this.contadorCpf = valor; }
    public String getContadorCrc() { return contadorCrc; }
    public void setContadorCrc(String valor) { this.contadorCrc = valor; }
    public String getContadorUfCrc() { return contadorUfCrc; }
    public void setContadorUfCrc(String valor) { this.contadorUfCrc = valor; }
    public String getContadorCnpjEscritorio() { return contadorCnpjEscritorio; }
    public void setContadorCnpjEscritorio(String valor) { this.contadorCnpjEscritorio = valor; }
    public String getContadorRazaoSocial() { return contadorRazaoSocial; }
    public void setContadorRazaoSocial(String valor) { this.contadorRazaoSocial = valor; }
    public String getContadorTelefone() { return contadorTelefone; }
    public void setContadorTelefone(String valor) { this.contadorTelefone = valor; }
    public String getContadorFax() { return contadorFax; }
    public void setContadorFax(String valor) { this.contadorFax = valor; }
    public String getContadorEmail() { return contadorEmail; }
    public void setContadorEmail(String valor) { this.contadorEmail = valor; }
    public String getContadorCep() { return contadorCep; }
    public void setContadorCep(String valor) { this.contadorCep = valor; }
    public String getContadorLogradouro() { return contadorLogradouro; }
    public void setContadorLogradouro(String valor) { this.contadorLogradouro = valor; }
    public String getContadorNumero() { return contadorNumero; }
    public void setContadorNumero(String valor) { this.contadorNumero = valor; }
    public String getContadorComplemento() { return contadorComplemento; }
    public void setContadorComplemento(String valor) { this.contadorComplemento = valor; }
    public String getContadorBairro() { return contadorBairro; }
    public void setContadorBairro(String valor) { this.contadorBairro = valor; }
    public String getContadorCidade() { return contadorCidade; }
    public void setContadorCidade(String valor) { this.contadorCidade = valor; }
    public String getContadorUf() { return contadorUf; }
    public void setContadorUf(String valor) { this.contadorUf = valor; }
    public String getContadorCodigoMunicipio() { return contadorCodigoMunicipio; }
    public void setContadorCodigoMunicipio(String valor) { this.contadorCodigoMunicipio = valor; }
}
