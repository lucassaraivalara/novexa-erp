package br.com.novexa.erp.service;

import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.repository.EmpresaRepository;
import org.springframework.stereotype.Service;

import java.util.List;


@Service
public class EmpresaService {

    private final EmpresaRepository empresaRepository;

    public EmpresaService(EmpresaRepository empresaRepository) {
        this.empresaRepository = empresaRepository;
    }

    // POST
    // metodo para cadastrar empresa
    public EmpresaEntity salvar(EmpresaEntity empresa) {
        return empresaRepository.save(empresa);
    }

    // GET
    // lista todas as empresas
    public List<EmpresaEntity> listar() {
        return empresaRepository.findAll();
    }


    public EmpresaEntity buscarPorId(Long id) {
        return empresaRepository.findById(id).orElseThrow();
    }

    public EmpresaEntity atualizarPorId(Long id, EmpresaEntity empresa) {
        // Busca a empresa que já existe no banco
        EmpresaEntity empresaExistente = empresaRepository.findById(id).orElseThrow();

        // Copia os novos dados recebidos para a empresa encontrada
        empresaExistente.setRazaoSocial(empresa.getRazaoSocial());
        empresaExistente.setNomeFantasia(empresa.getNomeFantasia());
        empresaExistente.setCnpj(empresa.getCnpj());
        empresaExistente.setInscricaoEstadual(empresa.getInscricaoEstadual());
        empresaExistente.setEmail(empresa.getEmail());
        empresaExistente.setTelefone(empresa.getTelefone());
        empresaExistente.setEndereco(empresa.getEndereco());
        empresaExistente.setAtivo(empresa.getAtivo());

        // Salva as alterações
        return empresaRepository.save(empresaExistente);
    }

    public void deletarPorId(Long id) {
        empresaRepository.deleteById(id);
    }
}


