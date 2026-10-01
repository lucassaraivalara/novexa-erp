package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.RecebivelRepository;
import br.com.novexa.erp.util.Paginacao;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;
import java.util.Set;

@Service
@Transactional(readOnly = true)
public class RecebivelService {
    private final RecebivelRepository recebiveis;
    public RecebivelService(RecebivelRepository recebiveis) { this.recebiveis = recebiveis; }

    @Transactional(propagation = Propagation.MANDATORY)
    public void gerar(PagamentoEntity pagamento) {
        if (pagamento.getFormaPagamento() == FormaPagamento.CARTAO_DEBITO
                || pagamento.getFormaPagamento() == FormaPagamento.CARTAO_CREDITO)
            recebiveis.saveAndFlush(new RecebivelEntity(pagamento));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void cancelar(VendaEntity venda) {
        // O chamador ja possui o lock da Venda. Liquidacao futura deve respeitar esse protocolo.
        var registros = recebiveis.findByEmpresaIdAndVendaIdOrderByIdAsc(venda.getEmpresa().getId(), venda.getId());
        if (registros.stream().anyMatch(r -> r.getStatus() == StatusRecebivel.LIQUIDADO))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Venda com recebivel liquidado exige reversao da liquidacao.");
        registros.stream().filter(r -> r.getStatus() == StatusRecebivel.PENDENTE).forEach(RecebivelEntity::cancelar);
        recebiveis.saveAll(registros);
    }

    public PaginaResponseDTO<RecebivelResponseDTO> listar(Long empresaId, StatusRecebivel status, TipoFormaPagamento tipo,
            LocalDate dataInicial, LocalDate dataFinal, Long vendaId, int page, int size, String sort) {
        if (tipo != null && tipo != TipoFormaPagamento.DEBITO && tipo != TipoFormaPagamento.CREDITO)
            throw Paginacao.invalida("tipo deve ser DEBITO ou CREDITO.");
        if (dataInicial != null && dataFinal != null && dataInicial.isAfter(dataFinal))
            throw Paginacao.invalida("dataInicial nao pode ser posterior a dataFinal.");
        var pageable = Paginacao.criar(page, size, sort,
                Set.of("id", "dataVenda", "tipo", "status", "valorBruto", "dataPrevistaRecebimento"), Sort.Direction.DESC);
        return PaginaResponseDTO.de(recebiveis.listarPagina(empresaId, status, tipo,
                dataInicial == null ? null : dataInicial.atStartOfDay(),
                dataFinal == null ? null : dataFinal.plusDays(1).atStartOfDay(), vendaId, pageable), RecebivelResponseDTO::de);
    }
}
