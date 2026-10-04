package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.TipoContaFinanceira;
import java.math.BigDecimal;

public record ContaFinanceiraResumoDTO(TipoContaFinanceira tipo, long quantidade, BigDecimal saldoAtual) { }
