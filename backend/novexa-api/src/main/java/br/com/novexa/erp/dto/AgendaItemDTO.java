package br.com.novexa.erp.dto;
import java.math.BigDecimal;
public record AgendaItemDTO(Long id,Long vendaId,BigDecimal bruto,BigDecimal taxas,BigDecimal liquido) { }
