package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record MovimentacaoCaixaResponseDTO(Long id, Long sessaoId, Long vendaId, Long usuarioId,
        UUID chaveRequisicao, TipoMovimentacaoCaixa tipo, BigDecimal valor, String observacao, LocalDateTime dataHora) {
    public static MovimentacaoCaixaResponseDTO de(MovimentacaoCaixaEntity m) {
        return new MovimentacaoCaixaResponseDTO(m.getId(), m.getSessao().getId(),
                m.getPagamento() == null ? null : m.getPagamento().getVenda().getId(), m.getUsuario().getId(),
                m.getChaveRequisicao(), m.getTipo(), m.getValor(), m.getObservacao(), m.getDataHora());
    }
}
