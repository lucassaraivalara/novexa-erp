package br.com.novexa.erp.service;

import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.entity.FornecedorEntity;
import br.com.novexa.erp.exception.FornecedorNotFoundException;
import br.com.novexa.erp.repository.FornecedorRepository;
import br.com.novexa.erp.util.DocumentoUtils;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
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

        return fornecedorRepository.save(fornecedor);
    }

    public List<FornecedorEntity> listar(Long empresaId) {
        buscarEmpresa(empresaId);
        return fornecedorRepository.findAllByEmpresaIdOrderByRazaoSocialAsc(empresaId);
    }

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

        fornecedorExistente.setRazaoSocial(dadosNovos.getRazaoSocial());
        fornecedorExistente.setNomeFantasia(dadosNovos.getNomeFantasia());
        fornecedorExistente.setCpfCnpj(dadosNovos.getCpfCnpj());
        fornecedorExistente.setInscricaoEstadual(dadosNovos.getInscricaoEstadual());
        fornecedorExistente.setEmail(dadosNovos.getEmail());
        fornecedorExistente.setTelefone(dadosNovos.getTelefone());
        fornecedorExistente.setEndereco(dadosNovos.getEndereco());
        fornecedorExistente.setAtivo(dadosNovos.getAtivo());

        return fornecedorRepository.save(fornecedorExistente);
    }

    public void inativar(Long id, Long empresaId) {
        FornecedorEntity fornecedor = buscarPorId(id, empresaId);
        fornecedor.setAtivo(false);
        fornecedorRepository.save(fornecedor);
    }

    private EmpresaEntity buscarEmpresa(Long empresaId) {
        return empresaService.buscarPorId(empresaId);
    }

    private void prepararDados(FornecedorEntity fornecedor, Boolean ativoPadrao) {
        fornecedor.setCpfCnpj(DocumentoUtils.normalizarEValidarCpfCnpj(fornecedor.getCpfCnpj()));

        if (fornecedor.getAtivo() == null) {
            fornecedor.setAtivo(ativoPadrao);
        }
    }
}
