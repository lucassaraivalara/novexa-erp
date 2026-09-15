package br.com.novexa.erp.mapper;

import br.com.novexa.erp.dto.CaixaRequestDTO;
import br.com.novexa.erp.dto.CaixaResponseDTO;
import br.com.novexa.erp.entity.CaixaEntity;
import org.springframework.stereotype.Component;

@Component
public class CaixaMapper {

    public CaixaEntity toEntity(CaixaRequestDTO request) {
        CaixaEntity caixa = new CaixaEntity();
        caixa.setDescricao(request.getDescricao());
        caixa.setAtivo(request.getAtivo());
        return caixa;
    }

    public CaixaResponseDTO toResponse(CaixaEntity caixa) {
        CaixaResponseDTO response = new CaixaResponseDTO();
        response.setId(caixa.getId());
        response.setDescricao(caixa.getDescricao());
        response.setAtivo(caixa.getAtivo());
        return response;
    }
}
