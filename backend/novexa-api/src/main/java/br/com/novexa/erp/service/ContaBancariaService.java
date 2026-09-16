package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.ContaBancariaRequestDTO;
import br.com.novexa.erp.dto.ContaBancariaResponseDTO;
import br.com.novexa.erp.entity.AgenciaEntity;
import br.com.novexa.erp.entity.ContaBancariaEntity;
import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.entity.TipoContaBancaria;
import br.com.novexa.erp.repository.AgenciaRepository;
import br.com.novexa.erp.repository.ContaBancariaRepository;
import br.com.novexa.erp.repository.EmpresaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Objects;

@Service
@Transactional(readOnly = true)
public class ContaBancariaService {

    private final ContaBancariaRepository contas;
    private final AgenciaRepository agencias;
    private final EmpresaRepository empresas;

    public ContaBancariaService(
            ContaBancariaRepository contas,
            AgenciaRepository agencias,
            EmpresaRepository empresas) {
        this.contas = contas;
        this.agencias = agencias;
        this.empresas = empresas;
    }

    public List<ContaBancariaResponseDTO> listar(
            Long empresaId,
            Long agenciaId,
            Long bancoId,
            TipoContaBancaria tipo,
            Boolean ativo) {
        return contas.listar(empresaId, agenciaId, bancoId, tipo, ativo)
                .stream()
                .map(ContaBancariaResponseDTO::de)
                .toList();
    }

    @Transactional
    public ContaBancariaResponseDTO criar(Long empresaId, ContaBancariaRequestDTO pedido) {
        EmpresaEntity empresa = buscarEmpresa(empresaId);
        AgenciaEntity agencia = buscarAgencia(pedido.agenciaId());
        validarAgenciaAtiva(agencia);

        String numero = pedido.numero().trim();
        String digito = normalizarOpcional(pedido.digito());
        validarDuplicidade(empresaId, agencia.getId(), numero, digito, null);

        ContaBancariaEntity conta = new ContaBancariaEntity(
                empresa,
                agencia,
                numero,
                digito,
                normalizarOpcional(pedido.titular()),
                pedido.tipo(),
                pedido.ativo() == null || pedido.ativo()
        );
        return ContaBancariaResponseDTO.de(contas.saveAndFlush(conta));
    }

    @Transactional
    public ContaBancariaResponseDTO atualizar(
            Long id,
            Long empresaId,
            ContaBancariaRequestDTO pedido) {
        ContaBancariaEntity conta = contas.buscarPorIdEEmpresa(id, empresaId)
                .orElseThrow(this::contaNaoEncontrada);
        AgenciaEntity agencia = buscarAgencia(pedido.agenciaId());
        boolean mudouAgencia = !Objects.equals(conta.getAgencia().getId(), agencia.getId());
        if (mudouAgencia) {
            validarAgenciaAtiva(agencia);
        }

        String numero = pedido.numero().trim();
        String digito = normalizarOpcional(pedido.digito());
        validarDuplicidade(empresaId, agencia.getId(), numero, digito, id);
        conta.atualizar(
                agencia,
                numero,
                digito,
                normalizarOpcional(pedido.titular()),
                pedido.tipo(),
                pedido.ativo() == null ? conta.isAtivo() : pedido.ativo()
        );
        return ContaBancariaResponseDTO.de(contas.saveAndFlush(conta));
    }

    private EmpresaEntity buscarEmpresa(Long empresaId) {
        return empresas.findById(empresaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Empresa nao encontrada."));
    }

    private AgenciaEntity buscarAgencia(Long agenciaId) {
        return agencias.findById(agenciaId).orElseThrow(this::agenciaNaoEncontrada);
    }

    private void validarAgenciaAtiva(AgenciaEntity agencia) {
        if (!agencia.isAtivo()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Nao e permitido vincular conta bancaria a agencia inativa."
            );
        }
    }

    private void validarDuplicidade(
            Long empresaId,
            Long agenciaId,
            String numero,
            String digito,
            Long idIgnorado) {
        if (contas.existeDuplicada(empresaId, agenciaId, numero, digito, idIgnorado)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Ja existe uma conta com este numero e digito para a agencia informada."
            );
        }
    }

    private String normalizarOpcional(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        return valor.trim();
    }

    private ResponseStatusException contaNaoEncontrada() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Conta bancaria nao encontrada.");
    }

    private ResponseStatusException agenciaNaoEncontrada() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Agencia nao encontrada.");
    }
}
