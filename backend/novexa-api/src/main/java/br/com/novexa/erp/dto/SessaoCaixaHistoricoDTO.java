package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.SessaoCaixaEntity;
import br.com.novexa.erp.entity.StatusSessaoCaixa;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public record SessaoCaixaHistoricoDTO(
        Long sessaoId,
        Long caixaId,
        String descricaoCaixa,
        StatusSessaoCaixa status,
        LocalDateTime dataHoraAbertura,
        Operador operadorAbertura,
        LocalDateTime dataHoraFechamento,
        Operador operadorFechamento,
        BigDecimal saldoInicial,
        BigDecimal totalVendas,
        BigDecimal dinheiroEsperado,
        BigDecimal valorInformado,
        BigDecimal diferenca) {

    public record Operador(Long id, String nome) { }

    public static SessaoCaixaHistoricoDTO de(SessaoCaixaEntity sessao, ResumoSessaoCaixaDTO resumo) {
        var fechamento = sessao.getUsuarioFechamento();
        return new SessaoCaixaHistoricoDTO(
                sessao.getId(), sessao.getCaixa().getId(), sessao.getCaixa().getDescricao(), sessao.getStatus(),
                sessao.getDataAbertura(), new Operador(sessao.getUsuarioAbertura().getId(), sessao.getUsuarioAbertura().getNomeUsuario()),
                sessao.getDataFechamento(), fechamento == null ? null : new Operador(fechamento.getId(), fechamento.getNomeUsuario()),
                sessao.getSaldoInicial(), resumo.totalVendas(), resumo.saldoEsperadoDinheiro(),
                sessao.getSaldoFinal(), resumo.diferenca());
    }
}