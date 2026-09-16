package br.com.novexa.erp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AgenciaRequestDTO(
        @NotNull(message = "O banco e obrigatorio.")
        Long bancoId,

        @NotBlank(message = "O numero da agencia e obrigatorio.")
        @Size(max = 20, message = "O numero da agencia deve ter no maximo 20 caracteres.")
        String numero,

        @Size(max = 5, message = "O digito deve ter no maximo 5 caracteres.")
        String digito,

        @Size(max = 150, message = "O contato deve ter no maximo 150 caracteres.")
        String contato,

        @Size(max = 20, message = "O telefone deve ter no maximo 20 caracteres.")
        String telefone,

        @Size(max = 120, message = "A cidade deve ter no maximo 120 caracteres.")
        String cidade,

        Boolean ativo) {
}
