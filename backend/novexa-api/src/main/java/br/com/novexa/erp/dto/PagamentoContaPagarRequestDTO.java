package br.com.novexa.erp.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import java.math.BigDecimal;
import java.time.LocalDate;

public record PagamentoContaPagarRequestDTO(
        LocalDate dataPagamento,
        @DecimalMin("0.01") @Digits(integer = 17, fraction = 2) BigDecimal valorPago) { }
