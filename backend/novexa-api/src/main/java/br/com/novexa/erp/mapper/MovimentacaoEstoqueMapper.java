package br.com.novexa.erp.mapper;

import br.com.novexa.erp.dto.MovimentacaoEstoqueResponseDTO;
import br.com.novexa.erp.entity.MovimentacaoEstoqueEntity;
import org.springframework.stereotype.Component;

@Component
public class MovimentacaoEstoqueMapper {

    public MovimentacaoEstoqueResponseDTO toResponse(MovimentacaoEstoqueEntity entity) {
        MovimentacaoEstoqueResponseDTO response = new MovimentacaoEstoqueResponseDTO();

        response.setId(entity.getId());
        response.setProdutoId(entity.getProduto().getId());
        response.setProdutoNome(entity.getProduto().getNome());
        response.setTipo(entity.getTipo());
        response.setOrigem(entity.getOrigem());
        response.setQuantidade(entity.getQuantidade());
        response.setSaldoAnterior(entity.getSaldoAnterior());
        response.setSaldoPosterior(entity.getSaldoPosterior());
        response.setMotivo(entity.getMotivo());
        response.setDataHora(entity.getDataHora());
        response.setUsuarioId(entity.getUsuario().getId());
        response.setNomeUsuario(entity.getUsuario().getNomeUsuario());

        return response;
    }
}