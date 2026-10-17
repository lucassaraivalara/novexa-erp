package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.FornecedorEntity;

public record FornecedorProdutoResponseDTO(Long id, String razaoSocial, String nomeFantasia, Boolean ativo) {
    public static FornecedorProdutoResponseDTO de(FornecedorEntity fornecedor) {
        return fornecedor == null ? null : new FornecedorProdutoResponseDTO(fornecedor.getId(),
            fornecedor.getRazaoSocial(), fornecedor.getNomeFantasia(), fornecedor.getAtivo());
    }
}
