package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.SubcategoriaProdutoEntity;

public record SubcategoriaProdutoResponseDTO(Long id, String nome, boolean ativo, CategoriaProdutoResponseDTO categoria) {
    public static SubcategoriaProdutoResponseDTO de(SubcategoriaProdutoEntity subcategoria) {
        return new SubcategoriaProdutoResponseDTO(subcategoria.getId(), subcategoria.getNome(), subcategoria.isAtivo(),
                CategoriaProdutoResponseDTO.de(subcategoria.getCategoria()));
    }
}
