package br.com.novexa.erp.dto;

import java.math.BigDecimal;

public record ResumoContasReceberDTO(Total vencidas, Total seteDias, Total trintaDias, Total emAberto, Total recebidasMes) {
    public record Total(BigDecimal total, long quantidade) { }
}
