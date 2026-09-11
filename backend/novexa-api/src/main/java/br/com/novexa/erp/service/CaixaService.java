package br.com.novexa.erp.service;

import br.com.novexa.erp.entity.CaixaEntity;
import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.exception.CaixaDuplicadoException;
import br.com.novexa.erp.exception.CaixaInvalidoException;
import br.com.novexa.erp.exception.CaixaNotFoundException;
import br.com.novexa.erp.repository.CaixaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class CaixaService {

    private final CaixaRepository caixaRepository;
    private final EmpresaService empresaService;

    public CaixaService(
            CaixaRepository caixaRepository,
            EmpresaService empresaService) {

        this.caixaRepository = caixaRepository;
        this.empresaService = empresaService;
    }

    public CaixaEntity salvar(CaixaEntity caixa, Long empresaId) {
        caixa.setEmpresa(buscarEmpresa(empresaId));
        prepararDados(caixa);
        validarDescricaoDuplicada(caixa, empresaId, null);

        return caixaRepository.save(caixa);
    }

    public List<CaixaEntity> listar(Long empresaId) {
        buscarEmpresa(empresaId);
        return caixaRepository.findAllByEmpresaIdOrderByDescricaoAsc(empresaId);
    }

    public CaixaEntity buscarPorId(Long id, Long empresaId) {
        buscarEmpresa(empresaId);

        return caixaRepository.findByIdAndEmpresaId(id, empresaId)
                .orElseThrow(() -> new CaixaNotFoundException(
                        "Caixa não encontrado para a empresa informada."
                ));
    }

    public CaixaEntity atualizar(
            Long id,
            CaixaEntity dadosNovos,
            Long empresaId) {

        CaixaEntity caixaExistente = buscarPorId(id, empresaId);
        prepararDados(dadosNovos);
        validarDescricaoDuplicada(dadosNovos, empresaId, id);

        caixaExistente.setDescricao(dadosNovos.getDescricao());
        return caixaRepository.save(caixaExistente);
    }

    public void inativar(Long id, Long empresaId) {
        CaixaEntity caixa = buscarPorId(id, empresaId);
        caixa.setAtivo(false);
        caixaRepository.save(caixa);
    }

    private EmpresaEntity buscarEmpresa(Long empresaId) {
        return empresaService.buscarPorId(empresaId);
    }

    private void prepararDados(CaixaEntity caixa) {
        if (caixa.getDescricao() == null || caixa.getDescricao().isBlank()) {
            throw new CaixaInvalidoException("A descrição do caixa é obrigatória.");
        }

        caixa.setDescricao(caixa.getDescricao().trim());

        if (caixa.getAtivo() == null) {
            caixa.setAtivo(true);
        }
    }

    private void validarDescricaoDuplicada(
            CaixaEntity caixa,
            Long empresaId,
            Long idIgnorado) {

        boolean duplicado = idIgnorado == null
                ? caixaRepository.findByEmpresaIdAndDescricaoNormalizada(
                empresaId,
                caixa.getDescricao()
        ).isPresent()
                : caixaRepository.findByEmpresaIdAndDescricaoNormalizadaAndIdNot(
                empresaId,
                caixa.getDescricao(),
                idIgnorado
        ).isPresent();

        if (duplicado) {
            throw new CaixaDuplicadoException(
                    "Já existe um caixa com esta descrição na empresa informada."
            );
        }
    }
}
