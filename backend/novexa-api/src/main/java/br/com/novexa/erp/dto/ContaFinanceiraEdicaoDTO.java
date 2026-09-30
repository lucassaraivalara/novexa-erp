package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.TipoContaFinanceira;
import jakarta.validation.constraints.*;

public record ContaFinanceiraEdicaoDTO(
        @NotBlank @Size(max = 150) String nome,
        @NotNull TipoContaFinanceira tipo, Long contaBancariaId) { }
