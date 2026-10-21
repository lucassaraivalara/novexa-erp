package br.com.novexa.erp.service;

import br.com.novexa.erp.time.TempoNovexa;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;
import jakarta.persistence.EntityManager;

@Service
@Transactional(readOnly = true)
public class ContaPagarService {
    private final ContaPagarRepository contas;
    private final EmpresaRepository empresas;
    private final FornecedorRepository fornecedores;
    private final ContaFinanceiraService financeiro;
    private final EntradaMercadoriaRepository entradas;
    private final EntityManager em;

    public ContaPagarService(ContaPagarRepository contas, EmpresaRepository empresas,
            FornecedorRepository fornecedores, ContaFinanceiraService financeiro,
            EntradaMercadoriaRepository entradas, EntityManager em) {
        this.contas = contas;
        this.empresas = empresas;
        this.fornecedores = fornecedores;
        this.financeiro = financeiro;
        this.entradas = entradas; this.em = em;
    }

    public ContaPagarResponseDTO buscar(Long id, Long empresaId) {
        return ContaPagarResponseDTO.de(contas.findByIdAndEmpresaId(id, empresaId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Conta a pagar não encontrada.")));
    }

    public PaginaResponseDTO<ContaPagarResponseDTO> listarPagina(Long empresaId, String busca, StatusContaPagar status,
            Long fornecedor, String categoria, java.time.LocalDate vencimentoDe, java.time.LocalDate vencimentoAte,
            java.time.LocalDate emissaoDe, java.time.LocalDate emissaoAte, int page, int size, String sort) {
        var pageable = br.com.novexa.erp.util.Paginacao.criar(page, size, sort,
                java.util.Set.of("id", "dataVencimento", "dataEmissao", "valor", "status", "categoria"), org.springframework.data.domain.Sort.Direction.ASC);
        if ((vencimentoDe != null && vencimentoAte != null && vencimentoDe.isAfter(vencimentoAte))
                || (emissaoDe != null && emissaoAte != null && emissaoDe.isAfter(emissaoAte)))
            throw br.com.novexa.erp.util.Paginacao.invalida("Periodo invalido.");
        return PaginaResponseDTO.de(contas.listarPagina(empresaId, busca == null ? "" : busca.trim(),
                status, fornecedor, categoria == null || categoria.isBlank() ? null : categoria,
                vencimentoDe, vencimentoAte, emissaoDe, emissaoAte, pageable), ContaPagarResponseDTO::de);
    }

    public List<ContaPagarResponseDTO> listar(Long empresaId) {
        return contas.findByEmpresaIdOrderByDataVencimentoAscIdAsc(empresaId).stream()
                .map(ContaPagarResponseDTO::de).toList();
    }

    public List<String> categorias(Long empresaId) { return contas.categorias(empresaId); }

    public ResumoContasPagarDTO resumo(Long empresaId) {
        var hoje = TempoNovexa.hoje();
        return new ResumoContasPagarDTO(total(empresaId, StatusContaPagar.ABERTA, null, hoje.minusDays(1)),
                total(empresaId, StatusContaPagar.ABERTA, hoje, hoje.plusDays(7)),
                total(empresaId, StatusContaPagar.ABERTA, hoje, hoje.plusDays(30)),
                total(empresaId, StatusContaPagar.ABERTA, null, null),
                total(empresaId, StatusContaPagar.PAGA, hoje.withDayOfMonth(1), hoje.withDayOfMonth(1).plusMonths(1).minusDays(1)));
    }

    private ResumoContasPagarDTO.Total total(Long empresaId, StatusContaPagar status, java.time.LocalDate inicio, java.time.LocalDate fim) {
        var total = contas.totalizar(empresaId, status, inicio, fim);
        return new ResumoContasPagarDTO.Total(total.getTotal(), total.getQuantidade());
    }

    @Transactional
    public ContaPagarResponseDTO criar(Long empresaId, ContaPagarRequestDTO pedido) {
        var empresa = empresas.findById(empresaId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Empresa não encontrada."));
        var conta = new ContaPagarEntity(empresa);
        preencher(conta, pedido, empresaId);
        return ContaPagarResponseDTO.de(contas.saveAndFlush(conta));
    }

    @Transactional
    public ContaPagarResponseDTO editar(Long id, Long empresaId, ContaPagarRequestDTO pedido) {
        var conta = buscarParaAlterar(id, empresaId);
        exigirAberta(conta);
        var entrada = conta.getEntradaMercadoria();
        if (entrada != null && !Objects.equals(pedido.fornecedorId(), conta.getFornecedor() == null ? null : conta.getFornecedor().getId()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Mantenha o fornecedor atual da conta enquanto existir vínculo.");
        preencher(conta, pedido, empresaId);
        return ContaPagarResponseDTO.de(contas.saveAndFlush(conta));
    }

    @Transactional
    public ContaPagarResponseDTO pagar(Long id, Long empresaId, Long usuarioId, PagamentoContaPagarRequestDTO pedido) {
        var conta = buscarParaAlterar(id, empresaId);
        exigirAberta(conta);
        BigDecimal pago = pedido.valorPago();
        if (pago.signum() <= 0 || pago.scale() > 2 || pago.precision() - pago.scale() > 17)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe um valor pago positivo com até duas casas decimais.");
        if (pago.compareTo(conta.getValor()) != 0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O pagamento deve corresponder ao valor integral da conta.");
        var movimento = financeiro.registrarSaidaContaPagar(empresaId, usuarioId, pedido.contaFinanceiraId(),
                "Pagamento conta a pagar #" + conta.getId(), pago, pedido.dataPagamento());
        conta.pagar(pedido.dataPagamento(), pago, movimento);
        return ContaPagarResponseDTO.de(contas.saveAndFlush(conta));
    }

    @Transactional
    public ContaPagarResponseDTO cancelar(Long id, Long empresaId) {
        var conta = buscarParaAlterar(id, empresaId);
        exigirAberta(conta);
        if (conta.getEntradaMercadoria() != null
                && conta.getEntradaMercadoria().getOrigemContaPagar() == OrigemContaPagarEntrada.GERADA)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cancele a entrada de origem para cancelar a conta gerada.");
        conta.cancelar();
        return ContaPagarResponseDTO.de(contas.saveAndFlush(conta));
    }

    @Transactional
    public ContaPagarResponseDTO estornar(Long id, Long empresaId, Long usuarioId) {
        var conta = buscarParaAlterar(id, empresaId);
        if (conta.getStatus() != StatusContaPagar.PAGA)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Somente contas pagas podem ser estornadas.");
        if (conta.getMovimentacaoFinanceira() != null)
            financeiro.estornarSaidaContaPagar(conta.getMovimentacaoFinanceira().getId(), empresaId, usuarioId,
                    "Estorno da baixa da conta a pagar #" + conta.getId());
        conta.abrir();
        return ContaPagarResponseDTO.de(contas.saveAndFlush(conta));
    }

    private void preencher(ContaPagarEntity conta, ContaPagarRequestDTO pedido, Long empresaId) {
        FornecedorEntity fornecedor = null;
        if (pedido.fornecedorId() != null) {
            fornecedor = fornecedores.findByIdAndEmpresaId(pedido.fornecedorId(), empresaId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Fornecedor não encontrado."));
        }
        conta.atualizar(pedido.descricao().trim(), opcional(pedido.documento()), fornecedor, opcional(pedido.categoria()),
                pedido.dataEmissao(), pedido.dataVencimento(), pedido.valor(), opcional(pedido.observacao()));
    }

    private String opcional(String texto) { return texto == null || texto.isBlank() ? null : texto.trim(); }

    private ContaPagarEntity buscarParaAlterar(Long id, Long empresaId) {
        var conta = contas.buscarParaAlterar(id, empresaId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Conta a pagar não encontrada."));
        em.refresh(conta);
        // Link/unlink/cancelamento da Entrada também detêm este lock de Conta a Pagar.
        conta.setEntradaMercadoria(entradas.findByContaPagarIdAndEmpresaId(id, empresaId).orElse(null));
        return conta;
    }

    private void exigirAberta(ContaPagarEntity conta) {
        if (conta.getStatus() != StatusContaPagar.ABERTA)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Somente contas abertas podem ser alteradas.");
    }
}
