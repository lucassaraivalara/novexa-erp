package br.com.novexa.erp.service;

import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.entity.FornecedorEntity;
import br.com.novexa.erp.entity.TipoPessoa;
import br.com.novexa.erp.exception.FornecedorNotFoundException;
import br.com.novexa.erp.repository.FornecedorRepository;
import br.com.novexa.erp.util.DocumentoUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import br.com.novexa.erp.util.Paginacao;

import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@Transactional
public class FornecedorService {

    private final FornecedorRepository fornecedorRepository;
    private final EmpresaService empresaService;

    public FornecedorService(
            FornecedorRepository fornecedorRepository,
            EmpresaService empresaService) {

        this.fornecedorRepository = fornecedorRepository;
        this.empresaService = empresaService;
    }

    public FornecedorEntity salvar(FornecedorEntity fornecedor, Long empresaId) {
        fornecedor.setEmpresa(buscarEmpresa(empresaId));
        prepararDados(fornecedor, true);
        fornecedor.setAtivo(true);
        validarDocumentoDuplicado(fornecedor.getCpfCnpj(), empresaId, null);

        return fornecedorRepository.saveAndFlush(fornecedor);
    }

    @Transactional(readOnly = true)
    public Page<FornecedorEntity> listarPagina(Long empresaId, String termo, Boolean ativo, int page, int size, String sort) {
        var pageable = Paginacao.criar(page, size, sort,
                Set.of("id", "razaoSocial", "nomeFantasia", "cpfCnpj", "ativo", "dataCadastro", "dataAtualizacao"),
                Sort.Direction.ASC);
        return fornecedorRepository.listarPagina(empresaId, ativo, padraoNome(termo), padraoDocumento(termo), pageable);
    }

    @Transactional(readOnly = true)
    public List<FornecedorEntity> buscarPorTermo(Long empresaId, String termo) {
        return fornecedorRepository.buscarPorTermo(empresaId, true, padraoNome(termo), padraoDocumento(termo),
                PageRequest.of(0, 20, Sort.by("razaoSocial", "id")));
    }

    @Transactional(readOnly = true)
    public FornecedorEntity buscarPorId(Long id, Long empresaId) {
        buscarEmpresa(empresaId);

        return fornecedorRepository.findByIdAndEmpresaId(id, empresaId)
                .orElseThrow(() -> new FornecedorNotFoundException(
                        "Fornecedor não encontrado para a empresa informada."
                ));
    }

    public FornecedorEntity atualizar(
            Long id,
            FornecedorEntity dadosNovos,
            Long empresaId) {

        FornecedorEntity fornecedorExistente = buscarPorId(id, empresaId);
        prepararDados(dadosNovos, fornecedorExistente.getAtivo());
        validarDocumentoDuplicado(dadosNovos.getCpfCnpj(), empresaId, id);

        fornecedorExistente.setRazaoSocial(dadosNovos.getRazaoSocial());
        fornecedorExistente.setNomeFantasia(dadosNovos.getNomeFantasia());
        fornecedorExistente.setCpfCnpj(dadosNovos.getCpfCnpj());
        fornecedorExistente.setInscricaoEstadual(dadosNovos.getInscricaoEstadual());
        fornecedorExistente.setEmail(dadosNovos.getEmail());
        fornecedorExistente.setTelefone(dadosNovos.getTelefone());
        fornecedorExistente.setEndereco(dadosNovos.getEndereco());
        fornecedorExistente.setAtivo(dadosNovos.getAtivo());
        fornecedorExistente.setTipoPessoa(dadosNovos.getTipoPessoa());
        fornecedorExistente.setCep(dadosNovos.getCep());
        fornecedorExistente.setLogradouro(dadosNovos.getLogradouro());
        fornecedorExistente.setNumero(dadosNovos.getNumero());
        fornecedorExistente.setComplemento(dadosNovos.getComplemento());
        fornecedorExistente.setBairro(dadosNovos.getBairro());
        fornecedorExistente.setCidade(dadosNovos.getCidade());
        fornecedorExistente.setUf(dadosNovos.getUf());
        fornecedorExistente.setObservacao(dadosNovos.getObservacao());

        return fornecedorRepository.saveAndFlush(fornecedorExistente);
    }

    public void inativar(Long id, Long empresaId) {
        FornecedorEntity fornecedor = buscarPorId(id, empresaId);
        fornecedor.setAtivo(false);
        fornecedorRepository.saveAndFlush(fornecedor);
    }

    private EmpresaEntity buscarEmpresa(Long empresaId) {
        return empresaService.buscarPorId(empresaId);
    }

    private void prepararDados(FornecedorEntity fornecedor, Boolean ativoPadrao) {
        fornecedor.setCpfCnpj(DocumentoUtils.normalizarEValidarCpfCnpj(fornecedor.getCpfCnpj()));
        String documento = fornecedor.getCpfCnpj();
        fornecedor.setTipoPessoa(documento == null ? null : documento.length() == 11 ? TipoPessoa.FISICA : TipoPessoa.JURIDICA);
        fornecedor.setRazaoSocial(limpar(fornecedor.getRazaoSocial()));
        fornecedor.setNomeFantasia(limpar(fornecedor.getNomeFantasia()));
        fornecedor.setInscricaoEstadual(limpar(fornecedor.getInscricaoEstadual()));
        fornecedor.setEmail(limpar(fornecedor.getEmail()));
        fornecedor.setTelefone(limpar(fornecedor.getTelefone()));
        fornecedor.setEndereco(limpar(fornecedor.getEndereco()));
        fornecedor.setLogradouro(limpar(fornecedor.getLogradouro()));
        fornecedor.setNumero(limpar(fornecedor.getNumero()));
        fornecedor.setComplemento(limpar(fornecedor.getComplemento()));
        fornecedor.setBairro(limpar(fornecedor.getBairro()));
        fornecedor.setCidade(limpar(fornecedor.getCidade()));
        fornecedor.setObservacao(limpar(fornecedor.getObservacao()));
        String uf = limpar(fornecedor.getUf());
        fornecedor.setUf(uf == null ? null : uf.toUpperCase(Locale.ROOT));
        String cep = limpar(fornecedor.getCep());
        if (cep != null) {
            cep = cep.replaceAll("\\D", "");
            if (cep.length() != 8) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CEP invalido.");
        }
        fornecedor.setCep(cep);

        if (fornecedor.getAtivo() == null) {
            fornecedor.setAtivo(ativoPadrao);
        }
    }

    private void validarDocumentoDuplicado(String documento, Long empresaId, Long id) {
        if (documento != null && fornecedorRepository.documentoJaCadastrado(empresaId, documento, id))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "CPF ou CNPJ ja cadastrado para um fornecedor desta empresa.");
    }

    private static String limpar(String valor) { return valor == null || valor.isBlank() ? null : valor.trim(); }

    private static String padraoNome(String termo) {
        String valor = termo == null ? "" : termo.trim();
        return "%" + valor.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
    }

    private static String padraoDocumento(String termo) {
        if (termo == null || !termo.matches("[0-9\\s./-]+")) return null;
        String documento = termo.replaceAll("\\D", "");
        return documento.isEmpty() ? null : "%" + documento + "%";
    }
}
