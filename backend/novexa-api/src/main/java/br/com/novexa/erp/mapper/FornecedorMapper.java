package br.com.novexa.erp.mapper;

import br.com.novexa.erp.dto.FornecedorRequestDTO;
import br.com.novexa.erp.dto.FornecedorResponseDTO;
import br.com.novexa.erp.entity.FornecedorEntity;
import org.springframework.stereotype.Component;

@Component
public class FornecedorMapper {

    public FornecedorEntity toEntity(FornecedorRequestDTO request) {
        FornecedorEntity fornecedor = new FornecedorEntity();
        preencherDados(request, fornecedor);
        return fornecedor;
    }

    public void atualizarEntity(FornecedorRequestDTO request, FornecedorEntity fornecedor) {
        preencherDados(request, fornecedor);
    }

    public FornecedorResponseDTO toResponse(FornecedorEntity fornecedor) {
        FornecedorResponseDTO response = new FornecedorResponseDTO();

        response.setId(fornecedor.getId());
        response.setEmpresaId(fornecedor.getEmpresa().getId());
        response.setRazaoSocial(fornecedor.getRazaoSocial());
        response.setNomeFantasia(fornecedor.getNomeFantasia());
        response.setCpfCnpj(fornecedor.getCpfCnpj());
        response.setInscricaoEstadual(fornecedor.getInscricaoEstadual());
        response.setEmail(fornecedor.getEmail());
        response.setTelefone(fornecedor.getTelefone());
        response.setEndereco(fornecedor.getEndereco());
        response.setAtivo(fornecedor.getAtivo());
        response.setDataCadastro(fornecedor.getDataCadastro());

        return response;
    }

    private void preencherDados(FornecedorRequestDTO request, FornecedorEntity fornecedor) {
        fornecedor.setRazaoSocial(request.getRazaoSocial());
        fornecedor.setNomeFantasia(request.getNomeFantasia());
        fornecedor.setCpfCnpj(request.getCpfCnpj());
        fornecedor.setInscricaoEstadual(request.getInscricaoEstadual());
        fornecedor.setEmail(request.getEmail());
        fornecedor.setTelefone(request.getTelefone());
        fornecedor.setEndereco(request.getEndereco());
        fornecedor.setAtivo(request.getAtivo());
    }
}
