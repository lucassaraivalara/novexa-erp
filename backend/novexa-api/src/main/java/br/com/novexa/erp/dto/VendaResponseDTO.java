package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record VendaResponseDTO(Long id, LocalDateTime dataHora, BigDecimal subtotal, BigDecimal desconto,
        BigDecimal total, FormaPagamento formaPagamento, BigDecimal valorRecebido, BigDecimal troco,
        Long clienteId, String entrega, String observacoes, List<ItemVendaDTO> itens, StatusVenda status, Long sessaoCaixaId) {
    public static VendaResponseDTO de(VendaEntity venda) {
        return new VendaResponseDTO(venda.getId(), venda.getDataHora(), venda.getSubtotal(), venda.getDesconto(),
                venda.getTotal(), venda.getFormaPagamento(), venda.getValorRecebido(), venda.getTroco(),
                venda.getCliente() == null ? null : venda.getCliente().getId(), venda.getEntrega(),
                venda.getObservacoes(), venda.getItens().stream().map(ItemVendaDTO::de).toList(), venda.getStatus(),
                venda.getSessaoCaixa() == null ? null : venda.getSessaoCaixa().getId());
    }
}
