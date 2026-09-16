package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.DashboardResumoDTO;
import br.com.novexa.erp.entity.StatusSessaoCaixa;
import br.com.novexa.erp.entity.StatusVenda;
import br.com.novexa.erp.entity.TipoMovimentacaoCaixa;
import br.com.novexa.erp.repository.ClienteRepository;
import br.com.novexa.erp.repository.MovimentacaoCaixaRepository;
import br.com.novexa.erp.repository.ProdutoRepository;
import br.com.novexa.erp.repository.SessaoCaixaRepository;
import br.com.novexa.erp.repository.VendaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class DashboardService {
    private final VendaRepository vendas;
    private final ProdutoRepository produtos;
    private final ClienteRepository clientes;
    private final SessaoCaixaRepository sessoes;
    private final MovimentacaoCaixaRepository movimentos;

    public DashboardService(VendaRepository vendas, ProdutoRepository produtos, ClienteRepository clientes,
                            SessaoCaixaRepository sessoes, MovimentacaoCaixaRepository movimentos) {
        this.vendas = vendas;
        this.produtos = produtos;
        this.clientes = clientes;
        this.sessoes = sessoes;
        this.movimentos = movimentos;
    }

    public DashboardResumoDTO resumo(Long empresaId) {
        LocalDate hoje = LocalDate.now();
        VendaRepository.ResumoVendasHoje vendasHoje = vendas.resumirPorPeriodo(
                empresaId, StatusVenda.FATURADA, hoje.atStartOfDay(), hoje.plusDays(1).atStartOfDay());
        BigDecimal faturamento = vendasHoje.getFaturamento() == null ? BigDecimal.ZERO : vendasHoje.getFaturamento();
        long quantidade = vendasHoje.getQuantidade();
        BigDecimal ticketMedio = quantidade == 0
                ? BigDecimal.ZERO.setScale(2)
                : faturamento.divide(BigDecimal.valueOf(quantidade), 2, RoundingMode.HALF_UP);

        var abertas = sessoes.findByEmpresaIdAndStatusOrderByDataAberturaAscIdAsc(
                empresaId, StatusSessaoCaixa.ABERTO);
        Map<Long, BigDecimal> saldosMovimentacoes = abertas.isEmpty()
                ? Map.of()
                : movimentos.resumirSaldos(
                        empresaId,
                        abertas.stream().map(sessao -> sessao.getId()).toList(),
                        java.util.List.of(TipoMovimentacaoCaixa.VENDA, TipoMovimentacaoCaixa.SUPRIMENTO),
                        java.util.List.of(TipoMovimentacaoCaixa.ESTORNO_VENDA, TipoMovimentacaoCaixa.SANGRIA))
                    .stream()
                    .collect(Collectors.toMap(
                            MovimentacaoCaixaRepository.SaldoMovimentacoesSessao::getSessaoId,
                            saldo -> saldo.getEntradas().subtract(saldo.getSaidas())));

        var sessoesAbertas = abertas.stream()
                .map(sessao -> new DashboardResumoDTO.SessaoCaixaAberta(
                        sessao.getId(),
                        sessao.getCaixa().getId(),
                        sessao.getCaixa().getDescricao(),
                        sessao.getSaldoInicial(),
                        sessao.getSaldoInicial().add(saldosMovimentacoes.getOrDefault(sessao.getId(), BigDecimal.ZERO))))
                .toList();

        return new DashboardResumoDTO(
                faturamento,
                quantidade,
                ticketMedio,
                produtos.contarEstoqueBaixo(empresaId),
                clientes.countByEmpresaIdAndAtivoTrue(empresaId),
                sessoesAbertas);
    }
}
