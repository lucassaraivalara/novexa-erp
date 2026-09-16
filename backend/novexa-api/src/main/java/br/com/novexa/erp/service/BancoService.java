package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.BancoRequestDTO;
import br.com.novexa.erp.dto.BancoResponseDTO;
import br.com.novexa.erp.entity.BancoEntity;
import br.com.novexa.erp.repository.BancoRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class BancoService {

    private final BancoRepository bancos;

    public BancoService(BancoRepository bancos) {
        this.bancos = bancos;
    }

    public List<BancoResponseDTO> listar() {
        return bancos.findAllByOrderByNomeAscNumeroAsc()
                .stream()
                .map(BancoResponseDTO::de)
                .toList();
    }

    @Transactional
    public BancoResponseDTO criar(BancoRequestDTO pedido) {
        String numero = pedido.numero().trim();
        if (bancos.existsByNumero(numero)) {
            throw numeroDuplicado();
        }

        BancoEntity banco = new BancoEntity(
                numero,
                pedido.nome().trim(),
                normalizarOpcional(pedido.cnab()),
                pedido.ativo() == null || pedido.ativo()
        );
        return BancoResponseDTO.de(bancos.saveAndFlush(banco));
    }

    @Transactional
    public BancoResponseDTO atualizar(Long id, BancoRequestDTO pedido) {
        BancoEntity banco = bancos.findById(id).orElseThrow(this::naoEncontrado);
        String numero = pedido.numero().trim();
        if (bancos.existsByNumeroAndIdNot(numero, id)) {
            throw numeroDuplicado();
        }

        banco.atualizar(
                numero,
                pedido.nome().trim(),
                normalizarOpcional(pedido.cnab()),
                pedido.ativo() == null ? banco.isAtivo() : pedido.ativo()
        );
        return BancoResponseDTO.de(bancos.saveAndFlush(banco));
    }

    private String normalizarOpcional(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        return valor.trim();
    }

    private ResponseStatusException naoEncontrado() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Banco nao encontrado.");
    }

    private ResponseStatusException numeroDuplicado() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "Ja existe um banco com este numero.");
    }
}
