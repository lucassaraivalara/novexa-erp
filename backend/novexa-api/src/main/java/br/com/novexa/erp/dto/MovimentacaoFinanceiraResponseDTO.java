package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record MovimentacaoFinanceiraResponseDTO(Long id, Long contaFinanceiraId, String contaFinanceiraNome,
        TipoMovimentacaoFinanceira tipo, OrigemMovimentacaoFinanceira origem, String descricao,
        BigDecimal valor, LocalDate dataMovimento, String observacao, Long usuarioId, String usuarioNome,
        LocalDateTime dataCriacao, boolean estornada, LocalDateTime dataEstorno,
        Long usuarioEstornoId, String usuarioEstornoNome, String motivoEstorno) {
    public static MovimentacaoFinanceiraResponseDTO de(MovimentacaoFinanceiraEntity movimento) {
        var estorno = movimento.getUsuarioEstorno();
        return new MovimentacaoFinanceiraResponseDTO(movimento.getId(),
                movimento.getContaFinanceira().getId(), movimento.getContaFinanceira().getNome(),
                movimento.getTipo(), movimento.getOrigem(), movimento.getDescricao(), movimento.getValor(),
                movimento.getDataMovimento(), movimento.getObservacao(), movimento.getUsuario().getId(),
                movimento.getUsuario().getNomeUsuario(), movimento.getDataCriacao(), movimento.isEstornada(),
                movimento.getDataEstorno(), estorno == null ? null : estorno.getId(),
                estorno == null ? null : estorno.getNomeUsuario(), movimento.getMotivoEstorno());
    }
}
