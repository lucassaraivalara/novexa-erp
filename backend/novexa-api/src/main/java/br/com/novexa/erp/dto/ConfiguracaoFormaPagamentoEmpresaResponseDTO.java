package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.*;
import java.time.LocalDateTime;
import java.math.BigDecimal;

public record ConfiguracaoFormaPagamentoEmpresaResponseDTO(Long id, String nomeExibicao,
        Long formaPagamentoId, TipoFormaPagamento tipo, boolean ativo, Destino contaFinanceiraDestino,
        LocalDateTime dataCriacao, LocalDateTime dataAtualizacao,
        BigDecimal taxaPercentual, BigDecimal taxaFixa, Integer prazoRecebimentoDias) {
    public record Destino(Long id, String nome, TipoContaFinanceira tipo, boolean ativo) { }
    public static ConfiguracaoFormaPagamentoEmpresaResponseDTO de(ConfiguracaoFormaPagamentoEmpresaEntity c) {
        var destino = c.getContaFinanceiraDestino();
        return new ConfiguracaoFormaPagamentoEmpresaResponseDTO(c.getId(), c.getNomeExibicao(),
                c.getFormaPagamento().getId(), c.getTipo(), c.isAtivo(), destino == null ? null
                : new Destino(destino.getId(), destino.getNome(), destino.getTipo(), destino.isAtivo()),
                c.getDataCriacao(), c.getDataAtualizacao(), c.getTaxaPercentual(), c.getTaxaFixa(), c.getPrazoRecebimentoDias());
    }
}
