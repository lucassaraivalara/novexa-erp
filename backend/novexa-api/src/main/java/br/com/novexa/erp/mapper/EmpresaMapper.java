package br.com.novexa.erp.mapper;

import br.com.novexa.erp.dto.EmpresaRequestDTO;
import br.com.novexa.erp.dto.EmpresaResponseDTO;
import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.entity.EmpresaInscricaoSt;
import br.com.novexa.erp.dto.EmpresaInscricaoStDTO;
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
        empresa.setCadastro(empresaDTO.getCadastro());
        empresa.setLogomarca(empresaDTO.getLogomarca());
        for (EmpresaInscricaoStDTO dto : empresaDTO.getInscricoesSt()) {
            EmpresaInscricaoSt inscricao = new EmpresaInscricaoSt();
            inscricao.setEmpresa(empresa);
            inscricao.setUf(dto.uf());
            inscricao.setInscricaoEstadual(dto.inscricaoEstadual());
            inscricao.setDifal(dto.difal());
            empresa.getInscricoesSt().add(inscricao);
        }

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
        responseDTO.setCadastro(empresa.getCadastro());

        return responseDTO;
    }

    // Listagem e autenticação não transportam a imagem nem inicializam relações lazy.
    public EmpresaResponseDTO paraDetalheDTO(EmpresaEntity empresa) {
        EmpresaResponseDTO dto = paraResponseDTO(empresa);
        dto.setLogomarca(empresa.getLogomarca());
        dto.setInscricoesSt(empresa.getInscricoesSt().stream().map(i ->
                new EmpresaInscricaoStDTO(i.getUf(), i.getInscricaoEstadual(), i.isDifal())).toList());
        return dto;
    }
}
