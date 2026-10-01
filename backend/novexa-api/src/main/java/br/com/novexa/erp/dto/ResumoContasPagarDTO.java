package br.com.novexa.erp.dto;

import java.math.BigDecimal;

public record ResumoContasPagarDTO(Total vencidas, Total seteDias, Total trintaDias, Total emAberto, Total pagasMes) {
    public record Total(BigDecimal total, long quantidade) { }
}
