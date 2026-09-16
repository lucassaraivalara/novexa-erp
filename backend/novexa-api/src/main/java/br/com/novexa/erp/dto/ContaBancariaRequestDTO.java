package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.TipoContaBancaria;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ContaBancariaRequestDTO(
        @NotNull(message = "A agencia e obrigatoria.")
        Long agenciaId,

        @NotBlank(message = "O numero da conta e obrigatorio.")
        @Size(max = 20, message = "O numero da conta deve ter no maximo 20 caracteres.")
        String numero,

        @Size(max = 5, message = "O digito deve ter no maximo 5 caracteres.")
        String digito,

        @Size(max = 150, message = "O titular deve ter no maximo 150 caracteres.")
        String titular,

        @NotNull(message = "O tipo da conta e obrigatorio.")
        TipoContaBancaria tipo,

        Boolean ativo) {
}
