package br.com.novexa.erp.dto;

import jakarta.validation.constraints.*;

public record MovimentacaoFinanceiraEstornoDTO(@NotBlank @Size(max = 500) String motivoEstorno) { }
