package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.repository.ContaFinanceiraRepository;
import br.com.novexa.erp.repository.RecebimentoContaRepository;
import br.com.novexa.erp.util.Paginacao;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.Set;

@Service
@Transactional(readOnly = true)
public class RecebimentoContaService {
    private final RecebimentoContaRepository recebimentos;
    private final ContaFinanceiraRepository contas;

    public RecebimentoContaService(RecebimentoContaRepository recebimentos, ContaFinanceiraRepository contas) {
        this.recebimentos = recebimentos;
        this.contas = contas;
    }

    public List<RecebimentoContaResumoDTO> resumir(Long empresaId) {
        return recebimentos.resumir(empresaId);
    }

    public PaginaResponseDTO<RecebimentoContaDTO> listar(Long empresaId, Long contaId, boolean semDestino,
            String status, int page, int size, String sort) {
        String situacao = status == null || status.isBlank() ? null : status.trim();
        if (situacao != null && !Set.of("A_LIQUIDAR", "LIQUIDADO").contains(situacao))
            throw Paginacao.invalida("Situacao deve ser A_LIQUIDAR ou LIQUIDADO.");
        if (contaId != null && semDestino)
            throw Paginacao.invalida("Informe uma conta ou consulte os recebimentos sem destino.");
        if (contaId != null && !contas.existsByIdAndEmpresaId(contaId, empresaId))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Conta financeira nao encontrada.");
        var pageable = Paginacao.criar(page, size, sort, Set.of("id", "dataHora", "valor"), Sort.Direction.DESC);
        return PaginaResponseDTO.de(recebimentos.listar(empresaId, contaId, semDestino, situacao, pageable), item -> item);
    }
}
