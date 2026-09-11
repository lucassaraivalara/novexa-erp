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

        response.setNomeFantasia(cliente.getNomeFantasia());
        response.setInscricaoEstadual(cliente.getInscricaoEstadual());
        response.setVendedor(cliente.getVendedor());
        response.setCondicaoPagamento(cliente.getCondicaoPagamento());
        response.setLimiteCredito(cliente.getLimiteCredito());
        response.setObservacoesInternas(cliente.getObservacoesInternas());
        response.setInstrucoesEntrega(cliente.getInstrucoesEntrega());
        // Materializa as coleções durante a transação, antes da serialização do DTO.
        response.setEnderecos(new java.util.ArrayList<>(cliente.getEnderecos()));
        response.setContatos(new java.util.ArrayList<>(cliente.getContatos()));

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
        cliente.setNomeFantasia(request.getNomeFantasia());
        cliente.setInscricaoEstadual(request.getInscricaoEstadual());
        cliente.setVendedor(request.getVendedor());
        cliente.setCondicaoPagamento(request.getCondicaoPagamento());
        cliente.setLimiteCredito(request.getLimiteCredito());
        cliente.setObservacoesInternas(request.getObservacoesInternas());
        cliente.setInstrucoesEntrega(request.getInstrucoesEntrega());
        cliente.setEnderecos(request.getEnderecos());
        cliente.setContatos(request.getContatos());
    }
}
