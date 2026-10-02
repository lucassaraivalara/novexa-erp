package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.RecebivelRepository;
import br.com.novexa.erp.repository.MovimentacaoFinanceiraRepository;
import br.com.novexa.erp.util.Paginacao;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.time.LocalDate;
import java.util.Set;

@Service
@Transactional(readOnly = true)
public class RecebivelService {
    private final RecebivelRepository recebiveis;
    private final MovimentacaoFinanceiraRepository movimentos;
    public RecebivelService(RecebivelRepository recebiveis, MovimentacaoFinanceiraRepository movimentos) {
        this.recebiveis = recebiveis; this.movimentos = movimentos;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void gerar(PagamentoEntity pagamento) {
        if (pagamento.getFormaPagamento() == FormaPagamento.CARTAO_DEBITO
                || pagamento.getFormaPagamento() == FormaPagamento.CARTAO_CREDITO) {
            RecebivelEntity recebivel;
            try {
                recebivel = new RecebivelEntity(pagamento);
            } catch (IllegalArgumentException | java.time.DateTimeException ex) {
                throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,
                        "Condicoes de cartao invalidas para esta venda: " + ex.getMessage());
            }
            recebiveis.saveAndFlush(recebivel);
        }
    }

    public PaginaResponseDTO<RecebivelResponseDTO> listar(Long empresaId, StatusRecebivel status, TipoFormaPagamento tipo,
            LocalDate dataInicial, LocalDate dataFinal, Long vendaId, int page, int size, String sort) {
        if (tipo != null && tipo != TipoFormaPagamento.DEBITO && tipo != TipoFormaPagamento.CREDITO)
            throw Paginacao.invalida("tipo deve ser DEBITO ou CREDITO.");
        if (dataInicial != null && dataFinal != null && dataInicial.isAfter(dataFinal))
            throw Paginacao.invalida("dataInicial nao pode ser posterior a dataFinal.");
        var pageable = Paginacao.criar(page, size, sort,
                Set.of("id", "dataVenda", "tipo", "status", "valorBruto", "dataPrevistaRecebimento"), Sort.Direction.DESC);
        var resultado = recebiveis.listarPagina(empresaId, status, tipo,
                dataInicial == null ? null : dataInicial.atStartOfDay(),
                dataFinal == null ? null : dataFinal.plusDays(1).atStartOfDay(), vendaId, pageable);
        var ids = resultado.getContent().stream().map(RecebivelEntity::getId).toList();
        java.util.Map<Long, Long> liquidacoes = new java.util.HashMap<>();
        if (!ids.isEmpty()) movimentos.buscarLiquidacoes(empresaId, ids)
                .forEach(m -> liquidacoes.put(m.getRecebivelId(), m.getMovimentoId()));
        return PaginaResponseDTO.de(resultado, r -> RecebivelResponseDTO.de(r, liquidacoes.get(r.getId())));
    }
}
