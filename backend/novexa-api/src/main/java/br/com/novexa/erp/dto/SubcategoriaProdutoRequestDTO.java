package br.com.novexa.erp.dto;

import jakarta.validation.constraints.*;

public record SubcategoriaProdutoRequestDTO(@NotBlank @Size(max = 100) String nome, Boolean ativo,
                                           @NotNull @Positive Long categoriaId) { }
