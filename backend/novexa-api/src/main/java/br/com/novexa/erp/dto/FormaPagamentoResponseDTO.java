package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.FormaPagamentoEntity;
import br.com.novexa.erp.entity.TipoFormaPagamento;

public record FormaPagamentoResponseDTO(Long id, String descricao, TipoFormaPagamento tipo, boolean ativo) {
    public static FormaPagamentoResponseDTO de(FormaPagamentoEntity forma) {
        return new FormaPagamentoResponseDTO(forma.getId(), forma.getDescricao(), forma.getTipo(), forma.isAtivo());
    }
}
