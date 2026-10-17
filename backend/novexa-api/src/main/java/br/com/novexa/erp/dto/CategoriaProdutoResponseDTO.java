package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.CategoriaProdutoEntity;

public record CategoriaProdutoResponseDTO(Long id, String nome, boolean ativo) {
    public static CategoriaProdutoResponseDTO de(CategoriaProdutoEntity categoria) {
        return new CategoriaProdutoResponseDTO(categoria.getId(), categoria.getNome(), categoria.isAtivo());
    }
}
