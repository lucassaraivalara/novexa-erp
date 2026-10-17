package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.MarcaEntity;

public record MarcaResponseDTO(Long id, String nome, boolean ativo) {
    public static MarcaResponseDTO de(MarcaEntity marca) {
        return new MarcaResponseDTO(marca.getId(), marca.getNome(), marca.isAtivo());
    }
}
