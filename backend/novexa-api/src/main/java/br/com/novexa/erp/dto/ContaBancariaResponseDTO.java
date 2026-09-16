package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.ContaBancariaEntity;
import br.com.novexa.erp.entity.TipoContaBancaria;

public record ContaBancariaResponseDTO(
        Long id,
        Long bancoId,
        String bancoNumero,
        String bancoNome,
        Long agenciaId,
        String agenciaNumero,
        String agenciaDigito,
        String numero,
        String digito,
        String titular,
        TipoContaBancaria tipo,
        boolean ativo) {

    public static ContaBancariaResponseDTO de(ContaBancariaEntity conta) {
        return new ContaBancariaResponseDTO(
                conta.getId(),
                conta.getAgencia().getBanco().getId(),
                conta.getAgencia().getBanco().getNumero(),
                conta.getAgencia().getBanco().getNome(),
                conta.getAgencia().getId(),
                conta.getAgencia().getNumero(),
                conta.getAgencia().getDigito(),
                conta.getNumero(),
                conta.getDigito(),
                conta.getTitular(),
                conta.getTipo(),
                conta.isAtivo()
        );
    }
}
