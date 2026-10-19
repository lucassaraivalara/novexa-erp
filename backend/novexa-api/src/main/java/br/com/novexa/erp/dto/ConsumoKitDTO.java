package br.com.novexa.erp.dto;
import br.com.novexa.erp.entity.ConsumoKitVendaEntity;
import java.math.BigDecimal;
public record ConsumoKitDTO(Long produtoId,String nome,String unidade,BigDecimal quantidade,BigDecimal custoUnitario,
        Long composicaoId,Long movimentoId,Long reversaoId) {
    public static ConsumoKitDTO de(ConsumoKitVendaEntity c){return new ConsumoKitDTO(c.componente.getId(),c.nome,c.unidade,c.quantidade,c.custoUnitario,c.composicaoId,c.movimentoId,c.reversaoId);}
}
