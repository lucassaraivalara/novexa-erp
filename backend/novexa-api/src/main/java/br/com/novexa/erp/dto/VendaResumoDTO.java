package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.StatusVenda;
import br.com.novexa.erp.entity.VendaEntity;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public record VendaResumoDTO(
        Long id,
        LocalDateTime dataHora,
        Long clienteId,
        String nomeCliente,
        BigDecimal total,
        StatusVenda status,
        Long sessaoCaixaId) {

    public static VendaResumoDTO de(VendaEntity venda) {
        var cliente = venda.getCliente();
        var sessao = venda.getSessaoCaixa();
        return new VendaResumoDTO(
                venda.getId(),
                venda.getDataHora(),
                cliente == null ? null : cliente.getId(),
                cliente == null ? null : cliente.getNome(),
                venda.getTotal(),
                venda.getStatus(),
                sessao == null ? null : sessao.getId());
    }
}
