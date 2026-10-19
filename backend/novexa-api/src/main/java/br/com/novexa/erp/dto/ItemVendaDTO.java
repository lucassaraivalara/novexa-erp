package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.ItemVendaEntity;
import java.math.BigDecimal;

public record ItemVendaDTO(Long id, Long produtoId, String nomeProduto, BigDecimal quantidade,
                           BigDecimal precoUnitario, BigDecimal subtotal, Long movimentacaoEstoqueId,
                           Integer ordem, java.util.List<ConsumoKitDTO> componentesConsumidos) {
    public ItemVendaDTO(Long id,Long produtoId,String nomeProduto,BigDecimal quantidade,BigDecimal precoUnitario,BigDecimal subtotal,Long movimentacaoEstoqueId,Integer ordem) {
        this(id,produtoId,nomeProduto,quantidade,precoUnitario,subtotal,movimentacaoEstoqueId,ordem,java.util.List.of());
    }
    public static ItemVendaDTO de(ItemVendaEntity item) {
        return new ItemVendaDTO(item.getId(), item.getProduto().getId(), item.getNomeProduto(),
                item.getQuantidade(), item.getPrecoUnitario(), item.getSubtotal(),
                item.getMovimentacaoEstoqueId(), item.getOrdem(),item.getComponentesConsumidos().stream().map(ConsumoKitDTO::de).toList());
    }
}
