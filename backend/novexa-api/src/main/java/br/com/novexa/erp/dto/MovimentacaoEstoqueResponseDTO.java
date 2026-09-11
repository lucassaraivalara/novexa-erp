package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.OrigemMovimentacaoEstoque;
import br.com.novexa.erp.entity.TipoMovimentacaoEstoque;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class MovimentacaoEstoqueResponseDTO {

    private Long id;
    private Long produtoId;
    private String produtoNome;
    private TipoMovimentacaoEstoque tipo;
    private OrigemMovimentacaoEstoque origem;
    private BigDecimal quantidade;
    private BigDecimal saldoAnterior;
    private BigDecimal saldoPosterior;
    private String motivo;
    private LocalDateTime dataHora;
    private Long usuarioId;
    private String nomeUsuario;

    public MovimentacaoEstoqueResponseDTO() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getProdutoId() {
        return produtoId;
    }

    public void setProdutoId(Long produtoId) {
        this.produtoId = produtoId;
    }

    public String getProdutoNome() {
        return produtoNome;
    }

    public void setProdutoNome(String produtoNome) {
        this.produtoNome = produtoNome;
    }

    public TipoMovimentacaoEstoque getTipo() {
        return tipo;
    }

    public void setTipo(TipoMovimentacaoEstoque tipo) {
        this.tipo = tipo;
    }

    public OrigemMovimentacaoEstoque getOrigem() {
        return origem;
    }

    public void setOrigem(OrigemMovimentacaoEstoque origem) {
        this.origem = origem;
    }

    public BigDecimal getQuantidade() {
        return quantidade;
    }

    public void setQuantidade(BigDecimal quantidade) {
        this.quantidade = quantidade;
    }

    public BigDecimal getSaldoAnterior() {
        return saldoAnterior;
    }

    public void setSaldoAnterior(BigDecimal saldoAnterior) {
        this.saldoAnterior = saldoAnterior;
    }

    public BigDecimal getSaldoPosterior() {
        return saldoPosterior;
    }

    public void setSaldoPosterior(BigDecimal saldoPosterior) {
        this.saldoPosterior = saldoPosterior;
    }

    public String getMotivo() {
        return motivo;
    }

    public void setMotivo(String motivo) {
        this.motivo = motivo;
    }

    public LocalDateTime getDataHora() {
        return dataHora;
    }

    public void setDataHora(LocalDateTime dataHora) {
        this.dataHora = dataHora;
    }

    public Long getUsuarioId() {
        return usuarioId;
    }

    public void setUsuarioId(Long usuarioId) {
        this.usuarioId = usuarioId;
    }

    public String getNomeUsuario() {
        return nomeUsuario;
    }

    public void setNomeUsuario(String nomeUsuario) {
        this.nomeUsuario = nomeUsuario;
    }
}