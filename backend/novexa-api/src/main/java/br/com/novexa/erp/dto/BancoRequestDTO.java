package br.com.novexa.erp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record BancoRequestDTO(
        @NotBlank(message = "O numero do banco e obrigatorio.")
        @Size(max = 10, message = "O numero do banco deve ter no maximo 10 caracteres.")
        String numero,

        @NotBlank(message = "O nome do banco e obrigatorio.")
        @Size(max = 150, message = "O nome do banco deve ter no maximo 150 caracteres.")
        String nome,

        @Size(max = 10, message = "O CNAB deve ter no maximo 10 caracteres.")
        String cnab,

        Boolean ativo) {
}
