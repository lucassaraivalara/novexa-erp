package br.com.novexa.erp.mapper;

import br.com.novexa.erp.dto.ClienteRequestDTO;
import br.com.novexa.erp.dto.ClienteResponseDTO;
import br.com.novexa.erp.entity.ClienteEntity;
import org.springframework.stereotype.Component;

@Component
public class ClienteMapper {

    public ClienteEntity toEntity(ClienteRequestDTO request) {
        ClienteEntity cliente = new ClienteEntity();
        preencherDados(request, cliente);
        return cliente;
    }

    public void atualizarEntity(ClienteRequestDTO request, ClienteEntity cliente) {
        preencherDados(request, cliente);
    }

    public ClienteResponseDTO toResponse(ClienteEntity cliente) {
        ClienteResponseDTO response = new ClienteResponseDTO();

        response.setId(cliente.getId());
        response.setEmpresaId(cliente.getEmpresa().getId());
        response.setNome(cliente.getNome());
        response.setTipoPessoa(cliente.getTipoPessoa());
        response.setCpfCnpj(cliente.getCpfCnpj());
        response.setEmail(cliente.getEmail());
        response.setTelefone(cliente.getTelefone());
        response.setEndereco(cliente.getEndereco());
        response.setAtivo(cliente.getAtivo());
        response.setDataCadastro(cliente.getDataCadastro());

        return response;
    }

    private void preencherDados(ClienteRequestDTO request, ClienteEntity cliente) {
        cliente.setNome(request.getNome());
        cliente.setTipoPessoa(request.getTipoPessoa());
        cliente.setCpfCnpj(request.getCpfCnpj());
        cliente.setEmail(request.getEmail());
        cliente.setTelefone(request.getTelefone());
        cliente.setEndereco(request.getEndereco());
        cliente.setAtivo(request.getAtivo());
    }
}
