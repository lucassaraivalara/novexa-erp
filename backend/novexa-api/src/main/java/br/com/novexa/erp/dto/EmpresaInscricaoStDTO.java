package br.com.novexa.erp.dto;

import jakarta.validation.constraints.*;

public record EmpresaInscricaoStDTO(
        @NotBlank @Pattern(regexp = "AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO", message = "UF da inscrição ST inválida.") String uf,
        @NotBlank(message = "Informe a inscrição estadual da outra UF.") @Size(max = 20) String inscricaoEstadual,
        boolean difal) {
}
