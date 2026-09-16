package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.AgenciaRequestDTO;
import br.com.novexa.erp.dto.AgenciaResponseDTO;
import br.com.novexa.erp.entity.AgenciaEntity;
import br.com.novexa.erp.entity.BancoEntity;
import br.com.novexa.erp.repository.AgenciaRepository;
import br.com.novexa.erp.repository.BancoRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Objects;

@Service
@Transactional(readOnly = true)
public class AgenciaService {

    private final AgenciaRepository agencias;
    private final BancoRepository bancos;

    public AgenciaService(AgenciaRepository agencias, BancoRepository bancos) {
        this.agencias = agencias;
        this.bancos = bancos;
    }

    public List<AgenciaResponseDTO> listar(Long bancoId) {
        List<AgenciaEntity> resultado = bancoId == null
                ? agencias.listarOrdenadas()
                : agencias.listarPorBanco(bancoId);
        return resultado.stream().map(AgenciaResponseDTO::de).toList();
    }

    @Transactional
    public AgenciaResponseDTO criar(AgenciaRequestDTO pedido) {
        BancoEntity banco = buscarBanco(pedido.bancoId());
        validarBancoAtivo(banco);
        String numero = pedido.numero().trim();
        validarDuplicidade(banco.getId(), numero, null);

        AgenciaEntity agencia = new AgenciaEntity(
                banco,
                numero,
                normalizarOpcional(pedido.digito()),
                normalizarOpcional(pedido.contato()),
                normalizarOpcional(pedido.telefone()),
                normalizarOpcional(pedido.cidade()),
                pedido.ativo() == null || pedido.ativo()
        );
        return AgenciaResponseDTO.de(agencias.saveAndFlush(agencia));
    }

    @Transactional
    public AgenciaResponseDTO atualizar(Long id, AgenciaRequestDTO pedido) {
        AgenciaEntity agencia = agencias.findById(id).orElseThrow(this::agenciaNaoEncontrada);
        BancoEntity banco = buscarBanco(pedido.bancoId());
        boolean mudouBanco = !Objects.equals(agencia.getBanco().getId(), banco.getId());
        if (mudouBanco) {
            validarBancoAtivo(banco);
        }

        String numero = pedido.numero().trim();
        validarDuplicidade(banco.getId(), numero, id);
        agencia.atualizar(
                banco,
                numero,
                normalizarOpcional(pedido.digito()),
                normalizarOpcional(pedido.contato()),
                normalizarOpcional(pedido.telefone()),
                normalizarOpcional(pedido.cidade()),
                pedido.ativo() == null ? agencia.isAtivo() : pedido.ativo()
        );
        return AgenciaResponseDTO.de(agencias.saveAndFlush(agencia));
    }

    private BancoEntity buscarBanco(Long bancoId) {
        return bancos.findById(bancoId).orElseThrow(this::bancoNaoEncontrado);
    }

    private void validarBancoAtivo(BancoEntity banco) {
        if (!banco.isAtivo()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Nao e permitido vincular agencia a banco inativo.");
        }
    }

    private void validarDuplicidade(Long bancoId, String numero, Long idIgnorado) {
        boolean duplicada = idIgnorado == null
                ? agencias.existsByBancoIdAndNumero(bancoId, numero)
                : agencias.existsByBancoIdAndNumeroAndIdNot(bancoId, numero, idIgnorado);
        if (duplicada) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Ja existe uma agencia com este numero para o banco informado."
            );
        }
    }

    private String normalizarOpcional(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        return valor.trim();
    }

    private ResponseStatusException agenciaNaoEncontrada() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Agencia nao encontrada.");
    }

    private ResponseStatusException bancoNaoEncontrado() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Banco nao encontrado.");
    }
}
