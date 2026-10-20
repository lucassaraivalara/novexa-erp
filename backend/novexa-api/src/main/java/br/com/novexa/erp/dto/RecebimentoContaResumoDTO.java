package br.com.novexa.erp.dto;

import java.math.BigDecimal;

public record RecebimentoContaResumoDTO(Long contaDestinoId, BigDecimal aLiquidar,
        BigDecimal liquidado, Long quantidadeALiquidar, Long quantidadeSemValor) { }
