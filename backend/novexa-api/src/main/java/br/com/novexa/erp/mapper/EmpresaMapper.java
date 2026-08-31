package br.com.novexa.erp.mapper;

import br.com.novexa.erp.dto.EmpresaRequestDTO;
import br.com.novexa.erp.dto.EmpresaResponseDTO;
import br.com.novexa.erp.entity.EmpresaEntity;
import org.springframework.stereotype.Component;

@Component
public class EmpresaMapper {

    public EmpresaEntity paraEntity(EmpresaRequestDTO empresaDTO) {

        EmpresaEntity empresa = new EmpresaEntity();

        empresa.setRazaoSocial(empresaDTO.getRazaoSocial());
        empresa.setNomeFantasia(empresaDTO.getNomeFantasia());
        empresa.setCnpj(empresaDTO.getCnpj());
        empresa.setInscricaoEstadual(empresaDTO.getInscricaoEstadual());
        empresa.setEmail(empresaDTO.getEmail());
        empresa.setTelefone(empresaDTO.getTelefone());
        empresa.setEndereco(empresaDTO.getEndereco());
        empresa.setAtivo(empresaDTO.getAtivo());

        return empresa;
    }

    public EmpresaResponseDTO paraResponseDTO(EmpresaEntity empresa) {

        if (empresa == null) {
            return null;
        }

        EmpresaResponseDTO responseDTO = new EmpresaResponseDTO();

        responseDTO.setId(empresa.getId());
        responseDTO.setRazaoSocial(empresa.getRazaoSocial());
        responseDTO.setNomeFantasia(empresa.getNomeFantasia());
        responseDTO.setCnpj(empresa.getCnpj());
        responseDTO.setInscricaoEstadual(empresa.getInscricaoEstadual());
        responseDTO.setEmail(empresa.getEmail());
        responseDTO.setTelefone(empresa.getTelefone());
        responseDTO.setEndereco(empresa.getEndereco());
        responseDTO.setAtivo(empresa.getAtivo());

        return responseDTO;
    }
}
