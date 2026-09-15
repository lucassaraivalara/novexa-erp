package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.SessaoCaixaEntity;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public record SessaoCaixaAbertaDTO(Long sessaoId, Long caixaId, String descricaoCaixa,
        BigDecimal saldoInicial, LocalDateTime dataHoraAbertura, Operador operadorAbertura) {
    public record Operador(Long id, String nome) { }
    public static SessaoCaixaAbertaDTO de(SessaoCaixaEntity s) {
        return new SessaoCaixaAbertaDTO(s.getId(), s.getCaixa().getId(), s.getCaixa().getDescricao(),
                s.getSaldoInicial(), s.getDataAbertura(),
                new Operador(s.getUsuarioAbertura().getId(), s.getUsuarioAbertura().getNomeUsuario()));
    }
}
