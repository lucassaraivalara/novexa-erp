package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.SessaoCaixaEntity;
import br.com.novexa.erp.entity.StatusSessaoCaixa;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public record SessaoCaixaResponseDTO(Long id, Long caixaId, StatusSessaoCaixa status,
        BigDecimal saldoInicial, BigDecimal saldoFinal, Long usuarioAberturaId,
        Long usuarioFechamentoId, LocalDateTime dataAbertura, LocalDateTime dataFechamento, ResumoSessaoCaixaDTO resumo) {
    public static SessaoCaixaResponseDTO from(SessaoCaixaEntity sessao) {
        return from(sessao, null);
    }
    public static SessaoCaixaResponseDTO from(SessaoCaixaEntity sessao, ResumoSessaoCaixaDTO resumo) {
        return new SessaoCaixaResponseDTO(sessao.getId(), sessao.getCaixa().getId(), sessao.getStatus(),
                sessao.getSaldoInicial(), sessao.getSaldoFinal(), sessao.getUsuarioAbertura().getId(),
                sessao.getUsuarioFechamento() == null ? null : sessao.getUsuarioFechamento().getId(),
                sessao.getDataAbertura(), sessao.getDataFechamento(), resumo);
    }
}
