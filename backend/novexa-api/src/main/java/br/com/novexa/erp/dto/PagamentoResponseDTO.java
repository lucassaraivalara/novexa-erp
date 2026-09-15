package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.FormaPagamento;
import br.com.novexa.erp.entity.PagamentoEntity;
import br.com.novexa.erp.entity.StatusPagamento;
import br.com.novexa.erp.entity.TipoFormaPagamento;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record PagamentoResponseDTO(Long id, Long empresaId, Long vendaId, Long usuarioId,
        int sequencia, UUID chaveRequisicao, FormaPagamento formaPagamento, BigDecimal valor,
        StatusPagamento status, LocalDateTime dataHora, BigDecimal valorRecebido, BigDecimal troco,
        Long formaPagamentoId, String descricaoFormaPagamento, TipoFormaPagamento tipoFormaPagamento) {
    public static PagamentoResponseDTO de(PagamentoEntity pagamento) {
        return new PagamentoResponseDTO(pagamento.getId(), pagamento.getEmpresa().getId(),
                pagamento.getVenda().getId(), pagamento.getUsuario().getId(), pagamento.getSequencia(),
                pagamento.getChaveRequisicao(), pagamento.getFormaPagamento(), pagamento.getValor(),
                pagamento.getStatus(), pagamento.getDataHora(), pagamento.getValorRecebido(), pagamento.getTroco(),
                pagamento.getForma().getId(), pagamento.getForma().getDescricao(), pagamento.getForma().getTipo());
    }
}
