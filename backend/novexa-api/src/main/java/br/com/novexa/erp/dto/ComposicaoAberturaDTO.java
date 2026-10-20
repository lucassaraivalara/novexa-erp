package br.com.novexa.erp.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ComposicaoAberturaDTO(
        BigDecimal valorTrocoHerdado,
        Long sessaoOrigemTrocoId,
        LocalDateTime dataFechamentoOrigem,
        BigDecimal valorRetiradoCofre,
        Long contaCofreId,
        String contaCofreNome,
        Long movimentoFinanceiroId,
        BigDecimal valorAporteExterno,
        String observacaoAporte,
        String operadorAbertura,
        LocalDateTime dataCriacao
) {}
