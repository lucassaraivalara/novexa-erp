package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ContaFinanceiraResponseDTO(Long id, String nome, TipoContaFinanceira tipo,
        BigDecimal saldoInicial, BigDecimal saldoAtual, boolean ativo,
        LocalDateTime dataCriacao, LocalDateTime dataAtualizacao) {
    public static ContaFinanceiraResponseDTO de(ContaFinanceiraEntity conta) {
        return new ContaFinanceiraResponseDTO(conta.getId(), conta.getNome(), conta.getTipo(),
                conta.getSaldoInicial(), conta.getSaldoAtual(), conta.isAtivo(),
                conta.getDataCriacao(), conta.getDataAtualizacao());
    }
}
