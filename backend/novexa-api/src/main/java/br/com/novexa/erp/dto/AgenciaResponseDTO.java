package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.AgenciaEntity;

public record AgenciaResponseDTO(
        Long id,
        Long bancoId,
        String bancoNumero,
        String bancoNome,
        String numero,
        String digito,
        String contato,
        String telefone,
        String cidade,
        boolean ativo) {

    public static AgenciaResponseDTO de(AgenciaEntity agencia) {
        return new AgenciaResponseDTO(
                agencia.getId(),
                agencia.getBanco().getId(),
                agencia.getBanco().getNumero(),
                agencia.getBanco().getNome(),
                agencia.getNumero(),
                agencia.getDigito(),
                agencia.getContato(),
                agencia.getTelefone(),
                agencia.getCidade(),
                agencia.isAtivo()
        );
    }
}
