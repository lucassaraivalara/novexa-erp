package br.com.novexa.erp.service;

import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.exception.EmpresaNotFoundException;
import br.com.novexa.erp.exception.CnpjDuplicadoException;
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

        // Verifica se já existe uma empresa
        // cadastrada com o mesmo CNPJ.
        if (empresaRepository.existsByCnpj(empresa.getCnpj())) {

            // Se já existir, interrompe o cadastro
            // e lança a exceção personalizada.
            throw new CnpjDuplicadoException(
                    "Já existe uma empresa cadastrada com o CNPJ: "
                            + empresa.getCnpj()
            );
        }

        // Se o CNPJ ainda não existir,
        // salva a nova empresa.
        return empresaRepository.save(empresa);
    }

    // GET
    // lista todas as empresas
    public List<EmpresaEntity> listar() {
        return empresaRepository.findAll();
    }


    public EmpresaEntity buscarPorId(Long id) {

        return empresaRepository.findById(id)
                .orElseThrow(() ->
                        new EmpresaNotFoundException(
                                "Empresa não encontrada com o ID: " + id
                        )
                );
    }

    public EmpresaEntity atualizarPorId(
            Long id,
            EmpresaEntity empresa) {

        // Primeiro verifica se a empresa que queremos
        // atualizar realmente existe.
        EmpresaEntity empresaExistente =
                empresaRepository.findById(id)
                        .orElseThrow(() ->
                                new EmpresaNotFoundException(
                                        "Empresa não encontrada com o ID: " + id
                                )
                        );

        // Verifica se o novo CNPJ pertence a OUTRA empresa.
        //
        // O "IdNot" faz o Spring ignorar a empresa
        // que estamos atualizando.
        if (empresaRepository.existsByCnpjAndIdNot(
                empresa.getCnpj(), id)) {

            // Se outra empresa já possui esse CNPJ,
            // interrompe a atualização.
            throw new CnpjDuplicadoException(
                    "Já existe outra empresa cadastrada com o CNPJ: "
                            + empresa.getCnpj()
            );
        }

        // Copia os novos dados recebidos para
        // a empresa que já existe no banco.
        empresaExistente.setRazaoSocial(empresa.getRazaoSocial());
        empresaExistente.setNomeFantasia(empresa.getNomeFantasia());
        empresaExistente.setCnpj(empresa.getCnpj());
        empresaExistente.setInscricaoEstadual(empresa.getInscricaoEstadual());
        empresaExistente.setEmail(empresa.getEmail());
        empresaExistente.setTelefone(empresa.getTelefone());
        empresaExistente.setEndereco(empresa.getEndereco());
        empresaExistente.setAtivo(empresa.getAtivo());

        // Salva as alterações.
        return empresaRepository.save(empresaExistente);
    }

    public void deletarPorId(Long id) {

        // Verifica se a empresa existe antes de excluir.
        if (!empresaRepository.existsById(id)) {

            // Se não existir, lança nossa exceção personalizada.
            throw new EmpresaNotFoundException(
                    "Empresa não encontrada com o ID: " + id
            );
        }

        // Se existir, realiza a exclusão.
        empresaRepository.deleteById(id);
    }
}


