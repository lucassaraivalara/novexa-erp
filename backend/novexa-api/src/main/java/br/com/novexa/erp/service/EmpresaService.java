package br.com.novexa.erp.service;

import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.entity.EmpresaInscricaoSt;
import br.com.novexa.erp.exception.EmpresaInvalidaException;
import br.com.novexa.erp.util.DocumentoEmpresaUtils;
import br.com.novexa.erp.util.DocumentoUtils;
import br.com.novexa.erp.util.LogomarcaUtils;
import br.com.novexa.erp.exception.EmpresaNotFoundException;
import br.com.novexa.erp.exception.CnpjDuplicadoException;
import br.com.novexa.erp.repository.EmpresaRepository;
import org.springframework.stereotype.Service;

import java.util.List;


@Service
@org.springframework.transaction.annotation.Transactional
public class EmpresaService {

    private final EmpresaRepository empresaRepository;

    public EmpresaService(EmpresaRepository empresaRepository) {
        this.empresaRepository = empresaRepository;
    }

    // POST
    // metodo para cadastrar empresa
    public EmpresaEntity salvar(EmpresaEntity empresa) {
        preparar(empresa);

        // Verifica se já existe uma empresa
        // cadastrada com o mesmo CNPJ.
        if (empresaRepository.documentoEmUso(empresa.getCnpj(), null)) {

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
        preparar(empresa);

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
        if (empresaRepository.documentoEmUso(
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
        empresaExistente.setCadastro(empresa.getCadastro());
        empresaExistente.setLogomarca(empresa.getLogomarca());
        // Reutiliza as inscrições da mesma UF e remove apenas as retiradas do formulário.
        var ufs = empresa.getInscricoesSt().stream().map(EmpresaInscricaoSt::getUf).toList();
        empresaExistente.getInscricoesSt().removeIf(i -> !ufs.contains(i.getUf()));
        for (var nova : empresa.getInscricoesSt()) {
            var destino = empresaExistente.getInscricoesSt().stream().filter(i -> i.getUf().equals(nova.getUf())).findFirst().orElse(null);
            if (destino == null) {
                destino = new EmpresaInscricaoSt();
                destino.setEmpresa(empresaExistente);
                destino.setUf(nova.getUf());
                empresaExistente.getInscricoesSt().add(destino);
            }
            destino.setInscricaoEstadual(nova.getInscricaoEstadual());
            destino.setDifal(nova.isDifal());
        }

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

    private void preparar(EmpresaEntity empresa) {
        var dados = empresa.getCadastro();
        if (dados == null || dados.getRegimeTributario() == null) throw new EmpresaInvalidaException("Informe o regime tributário.");
        empresa.setCnpj(DocumentoEmpresaUtils.validar(empresa.getCnpj(), Boolean.TRUE.equals(dados.getProdutorRural())));
        empresa.setRazaoSocial(empresa.getRazaoSocial().trim());
        empresa.setLogomarca(LogomarcaUtils.validar(empresa.getLogomarca()));
        if ((dados.getLatitude() == null) != (dados.getLongitude() == null)) throw new EmpresaInvalidaException("Preencha latitude e longitude juntas.");
        if (preenchido(dados.getContadorCpf())) {
            if (!DocumentoEmpresaUtils.normalizar(dados.getContadorCpf()).matches("[0-9]{11}")) throw new EmpresaInvalidaException("CPF do contador inválido.");
            dados.setContadorCpf(DocumentoUtils.normalizarEValidarCpfCnpj(dados.getContadorCpf()));
        }
        if (preenchido(dados.getContadorCnpjEscritorio())) dados.setContadorCnpjEscritorio(DocumentoEmpresaUtils.validar(dados.getContadorCnpjEscritorio(), false));
        if (java.util.stream.Stream.of(dados.getContadorNome(), dados.getContadorCpf(), dados.getContadorCrc(),
                dados.getContadorUfCrc(), dados.getContadorCnpjEscritorio(), dados.getContadorRazaoSocial(),
                dados.getContadorTelefone(), dados.getContadorFax(), dados.getContadorEmail(), dados.getContadorCep(),
                dados.getContadorLogradouro(), dados.getContadorNumero(), dados.getContadorComplemento(),
                dados.getContadorBairro(), dados.getContadorUf(), dados.getContadorCodigoMunicipio()).anyMatch(this::preenchido)
                && !preenchido(dados.getContadorCidade())) throw new EmpresaInvalidaException("Informe a cidade do contador.");
        if (preenchido(dados.getContadorCrc()) && !preenchido(dados.getContadorUfCrc())) throw new EmpresaInvalidaException("Informe a UF do CRC.");
        var ufs = new java.util.HashSet<String>();
        for (var inscricao : empresa.getInscricoesSt()) {
            if (!ufs.add(inscricao.getUf())) throw new EmpresaInvalidaException("Cadastre somente uma inscrição ST por UF.");
            if (inscricao.getUf().equals(dados.getUf())) throw new EmpresaInvalidaException("A inscrição ST deve ser de outra UF.");
            inscricao.setInscricaoEstadual(inscricao.getInscricaoEstadual().trim());
        }
    }

    private boolean preenchido(String valor) { return valor != null && !valor.isBlank(); }
}


