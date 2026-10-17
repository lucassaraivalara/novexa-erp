package br.com.novexa.erp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CategoriaProdutoRequestDTO(@NotBlank @Size(max = 100) String nome, Boolean ativo) { }
