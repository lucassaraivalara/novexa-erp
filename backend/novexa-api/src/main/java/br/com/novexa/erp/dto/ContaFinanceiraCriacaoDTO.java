package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.TipoContaFinanceira;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public record ContaFinanceiraCriacaoDTO(
        @NotBlank @Size(max = 150) String nome,
        @NotNull TipoContaFinanceira tipo,
        @NotNull @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal saldoInicial,
        Long contaBancariaId) { }
