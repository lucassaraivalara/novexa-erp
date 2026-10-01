package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.ClienteResponseDTO;
import br.com.novexa.erp.dto.PaginaResponseDTO;
import br.com.novexa.erp.entity.ClienteEntity;
import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.exception.ClienteNotFoundException;
import br.com.novexa.erp.mapper.ClienteMapper;
import br.com.novexa.erp.repository.ClienteRepository;
import br.com.novexa.erp.util.DocumentoUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class ClienteService {

    private final ClienteRepository clienteRepository;
    private final EmpresaService empresaService;
    private final ClienteMapper clienteMapper;

    public ClienteService(
            ClienteRepository clienteRepository,
            EmpresaService empresaService,
            ClienteMapper clienteMapper) {

        this.clienteRepository = clienteRepository;
        this.empresaService = empresaService;
        this.clienteMapper = clienteMapper;
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

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public PaginaResponseDTO<ClienteResponseDTO> listarPaginado(Long empresaId,
            String situacao,
            String busca,
            String campoBusca,
            String sort,
            int page,
            int size) {
        if (page < 0) throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "page deve ser >= 0");
        if (size < 1) throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "size deve ser >= 1");
        if (size > 100) throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "size máximo é 100");

        String[] camposPermitidos = {"id", "nome", "nomeFantasia", "cpfCnpj", "cidadeUf", "telefone", "ativo"};
        var validado = br.com.novexa.erp.util.Paginacao.criar(page, size, sort,
                java.util.Set.of(camposPermitidos), org.springframework.data.domain.Sort.Direction.ASC);
        String campoOrdenacao = validado.getSort().iterator().next().getProperty();
        String direcao = validado.getSort().iterator().next().getDirection().name().toLowerCase(java.util.Locale.ROOT);
        if (campoBusca != null && !java.util.Set.of("id", "nome", "nomeFantasia", "cpfCnpj", "cidadeUf", "telefone").contains(campoBusca))
            throw br.com.novexa.erp.util.Paginacao.invalida("Campo de busca invalido.");
        if (situacao != null && !java.util.Set.of("ativos", "inativos", "todos").contains(situacao))
            throw br.com.novexa.erp.util.Paginacao.invalida("Situacao invalida.");

        boolean campoValido = false;
        for (String c : camposPermitidos) {
            if (c.equals(campoOrdenacao)) {
                campoValido = true;
                break;
            }
        }
        if (!campoValido) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Campo de ordenação inválido: " + campoOrdenacao);
        }
        if (!direcao.equalsIgnoreCase("asc") && !direcao.equalsIgnoreCase("desc")) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Direção de ordenação inválida: " + direcao);
        }

        Boolean ativoFiltro = null;
        if ("ativos".equals(situacao)) {
            ativoFiltro = true;
        } else if ("inativos".equals(situacao)) {
            ativoFiltro = false;
        }

        Pageable pageable = org.springframework.data.domain.PageRequest.of(page, size);

        var pageResult = clienteRepository.findAllPaginado(
                empresaId,
                ativoFiltro,
                busca == null ? "" : busca.trim(),
                campoBusca,
                campoOrdenacao,
                direcao,
                pageable);

        return PaginaResponseDTO.de(pageResult, clienteMapper::toResponse);
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
        clienteExistente.setNomeFantasia(dadosNovos.getNomeFantasia());
        clienteExistente.setInscricaoEstadual(dadosNovos.getInscricaoEstadual());
        clienteExistente.setVendedor(dadosNovos.getVendedor());
        clienteExistente.setCondicaoPagamento(dadosNovos.getCondicaoPagamento());
        clienteExistente.setLimiteCredito(dadosNovos.getLimiteCredito());
        clienteExistente.setObservacoesInternas(dadosNovos.getObservacoesInternas());
        clienteExistente.setInstrucoesEntrega(dadosNovos.getInstrucoesEntrega());
        clienteExistente.setEnderecos(dadosNovos.getEnderecos());
        clienteExistente.setContatos(dadosNovos.getContatos());

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
