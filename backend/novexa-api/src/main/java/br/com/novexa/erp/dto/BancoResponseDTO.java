package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.BancoEntity;

public record BancoResponseDTO(Long id, String numero, String nome, String cnab, boolean ativo) {

    public static BancoResponseDTO de(BancoEntity banco) {
        return new BancoResponseDTO(
                banco.getId(),
                banco.getNumero(),
                banco.getNome(),
                banco.getCnab(),
                banco.isAtivo()
        );
    }
}
