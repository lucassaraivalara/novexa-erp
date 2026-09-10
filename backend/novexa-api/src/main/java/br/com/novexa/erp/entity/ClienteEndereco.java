package br.com.novexa.erp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.validation.constraints.*;

@Embeddable
public class ClienteEndereco {
    @NotBlank
    @Size(max = 150)
    @Column(length = 150)
    private String logradouro;
    @Size(max = 20)
    @Column(length = 20)
    private String numero;
    @Size(max = 100)
    @Column(length = 100)
    private String complemento;
    @Size(max = 100)
    @Column(length = 100)
    private String bairro;
    @NotBlank
    @Size(max = 100)
    @Column(length = 100)
    private String cidade;
    @NotBlank
    @Pattern(regexp = "AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO", message = "Informe uma UF válida.")
    @Column(length = 2)
    private String uf;
    @Pattern(regexp = "(^$|[0-9]{8})", message = "CEP deve ter 8 dígitos.")
    @Column(length = 8)
    private String cep;

    private boolean principal;

    private boolean entrega;
    public String getLogradouro() { return logradouro; }
    public void setLogradouro(String logradouro) { this.logradouro = logradouro; }
    public String getNumero() { return numero; }
    public void setNumero(String numero) { this.numero = numero; }
    public String getComplemento() { return complemento; }
    public void setComplemento(String complemento) { this.complemento = complemento; }
    public String getBairro() { return bairro; }
    public void setBairro(String bairro) { this.bairro = bairro; }
    public String getCidade() { return cidade; }
    public void setCidade(String cidade) { this.cidade = cidade; }
    public String getUf() { return uf; }
    public void setUf(String uf) { this.uf = uf; }
    public String getCep() { return cep; }
    public void setCep(String cep) { this.cep = cep; }
    public boolean getPrincipal() { return principal; }
    public void setPrincipal(boolean principal) { this.principal = principal; }
    public boolean getEntrega() { return entrega; }
    public void setEntrega(boolean entrega) { this.entrega = entrega; }
}
