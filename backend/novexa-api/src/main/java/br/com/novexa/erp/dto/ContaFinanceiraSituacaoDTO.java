package br.com.novexa.erp.dto;

import jakarta.validation.constraints.NotNull;

public record ContaFinanceiraSituacaoDTO(@NotNull Boolean ativo) { }
