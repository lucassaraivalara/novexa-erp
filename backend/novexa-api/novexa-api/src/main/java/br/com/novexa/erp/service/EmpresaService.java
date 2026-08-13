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
    public EmpresaEntity salvar(EmpresaEntity empresa) {
        return empresaRepository.save(empresa);
    }

    // GET
    public List<EmpresaEntity> listar() {
        return empresaRepository.findAll();
    }
}