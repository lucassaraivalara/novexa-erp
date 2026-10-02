package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.FornecedorEntity;

public record FornecedorBuscaResponseDTO(Long id, String razaoSocial, String nomeFantasia, String cpfCnpj, String telefone) {
    public static FornecedorBuscaResponseDTO de(FornecedorEntity fornecedor) {
        return new FornecedorBuscaResponseDTO(fornecedor.getId(), fornecedor.getRazaoSocial(),
                fornecedor.getNomeFantasia(), fornecedor.getCpfCnpj(), fornecedor.getTelefone());
    }
}
