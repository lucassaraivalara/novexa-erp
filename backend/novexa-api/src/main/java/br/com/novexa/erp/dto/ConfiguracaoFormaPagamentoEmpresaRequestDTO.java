package br.com.novexa.erp.dto;

import jakarta.validation.constraints.*;

public record ConfiguracaoFormaPagamentoEmpresaRequestDTO(
        @NotNull @Positive Long formaPagamentoId,
        @NotBlank @Size(max = 150) String nomeExibicao,
        Boolean ativo,
        @Positive Long contaFinanceiraDestinoId) { }
