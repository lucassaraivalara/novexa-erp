package br.com.novexa.erp.service;

import br.com.novexa.erp.entity.ClienteEntity;
import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.exception.ClienteNotFoundException;
import br.com.novexa.erp.repository.ClienteRepository;
import br.com.novexa.erp.util.DocumentoUtils;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ClienteService {

    private final ClienteRepository clienteRepository;
    private final EmpresaService empresaService;

    public ClienteService(
            ClienteRepository clienteRepository,
            EmpresaService empresaService) {

        this.clienteRepository = clienteRepository;
        this.empresaService = empresaService;
    }

    public ClienteEntity salvar(ClienteEntity cliente, Long empresaId) {
        cliente.setEmpresa(buscarEmpresa(empresaId));
        prepararDados(cliente, true);

        return clienteRepository.save(cliente);
    }

    public List<ClienteEntity> listar(Long empresaId) {
        buscarEmpresa(empresaId);
        return clienteRepository.findAllByEmpresaIdOrderByNomeAsc(empresaId);
    }

    public ClienteEntity buscarPorId(Long id, Long empresaId) {
        buscarEmpresa(empresaId);

        return clienteRepository.findByIdAndEmpresaId(id, empresaId)
                .orElseThrow(() -> new ClienteNotFoundException(
                        "Cliente não encontrado para a empresa informada."
                ));
    }

    public ClienteEntity atualizar(
            Long id,
            ClienteEntity dadosNovos,
            Long empresaId) {

        ClienteEntity clienteExistente = buscarPorId(id, empresaId);
        prepararDados(dadosNovos, clienteExistente.getAtivo());

        clienteExistente.setNome(dadosNovos.getNome());
        clienteExistente.setTipoPessoa(dadosNovos.getTipoPessoa());
        clienteExistente.setCpfCnpj(dadosNovos.getCpfCnpj());
        clienteExistente.setEmail(dadosNovos.getEmail());
        clienteExistente.setTelefone(dadosNovos.getTelefone());
        clienteExistente.setEndereco(dadosNovos.getEndereco());
        clienteExistente.setAtivo(dadosNovos.getAtivo());

        return clienteRepository.save(clienteExistente);
    }

    public void inativar(Long id, Long empresaId) {
        ClienteEntity cliente = buscarPorId(id, empresaId);
        cliente.setAtivo(false);
        clienteRepository.save(cliente);
    }

    private EmpresaEntity buscarEmpresa(Long empresaId) {
        return empresaService.buscarPorId(empresaId);
    }

    private void prepararDados(ClienteEntity cliente, Boolean ativoPadrao) {
        cliente.setCpfCnpj(DocumentoUtils.normalizarEValidarCpfCnpj(cliente.getCpfCnpj()));

        if (cliente.getAtivo() == null) {
            cliente.setAtivo(ativoPadrao);
        }
    }
}
