package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record TransferenciaFinanceiraResponseDTO(Long id, Long contaOrigemId, String contaOrigemNome,
        Long contaDestinoId, String contaDestinoNome, BigDecimal valor, LocalDate dataMovimento,
        String observacao, StatusTransferenciaFinanceira status, UUID chaveRequisicao,
        Long usuarioId, String usuarioNome, LocalDateTime dataCriacao, LocalDateTime dataEstorno,
        Long usuarioEstornoId, String usuarioEstornoNome, String motivoEstorno) {
    public static TransferenciaFinanceiraResponseDTO de(TransferenciaFinanceiraEntity t) {
        var estorno = t.getUsuarioEstorno();
        return new TransferenciaFinanceiraResponseDTO(t.getId(), t.getContaOrigem().getId(),
                t.getContaOrigem().getNome(), t.getContaDestino().getId(), t.getContaDestino().getNome(),
                t.getValor(), t.getDataMovimento(), t.getObservacao(), t.getStatus(), t.getChaveRequisicao(),
                t.getUsuario().getId(), t.getUsuario().getNomeUsuario(), t.getDataCriacao(), t.getDataEstorno(),
                estorno == null ? null : estorno.getId(), estorno == null ? null : estorno.getNomeUsuario(),
                t.getMotivoEstorno());
    }
}
