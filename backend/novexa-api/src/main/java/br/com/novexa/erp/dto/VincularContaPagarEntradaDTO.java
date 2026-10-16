package br.com.novexa.erp.dto;

import jakarta.validation.constraints.*;

public record VincularContaPagarEntradaDTO(@NotNull @Positive Long contaPagarId) { }
