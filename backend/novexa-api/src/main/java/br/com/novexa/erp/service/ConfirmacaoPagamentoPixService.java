package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.PagamentoResponseDTO;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import jakarta.persistence.EntityManager;
import org.springframework.transaction.annotation.Propagation;

@Service
public class ConfirmacaoPagamentoPixService {
    private final PagamentoRepository pagamentos;
    private final ContaFinanceiraRepository contas;
    private final MovimentacaoFinanceiraRepository movimentos;
    private final UsuarioRepository usuarios;
    private final VendaRepository vendas;
    private final EntityManager em;

    public ConfirmacaoPagamentoPixService(PagamentoRepository pagamentos, ContaFinanceiraRepository contas,
            MovimentacaoFinanceiraRepository movimentos, UsuarioRepository usuarios, VendaRepository vendas, EntityManager em) {
        this.pagamentos = pagamentos; this.contas = contas; this.movimentos = movimentos; this.usuarios = usuarios;
        this.vendas = vendas; this.em = em;
    }

    @Transactional
    public PagamentoResponseDTO confirmar(Long id, Long empresaId, Long usuarioId) {
        var vendaId = pagamentos.buscarVendaId(id, empresaId)
                .orElseThrow(() -> erro(HttpStatus.NOT_FOUND, "Pagamento nao encontrado."));
        // Mesma ordem do cancelamento: operador, Venda, Pagamento, ContaFinanceira.
        vendas.bloquearOperador(usuarioId, empresaId)
                .orElseThrow(() -> erro(HttpStatus.NOT_FOUND, "Usuario nao encontrado."));
        vendas.findByIdAndEmpresaIdWithLock(vendaId, empresaId)
                .orElseThrow(() -> erro(HttpStatus.NOT_FOUND, "Venda nao encontrada."));
        var pagamento = pagamentos.buscarParaConfirmar(id, empresaId)
                .orElseThrow(() -> erro(HttpStatus.NOT_FOUND, "Pagamento nao encontrado."));
        if (pagamento.getStatus() == StatusPagamento.CANCELADO)
            throw erro(HttpStatus.CONFLICT, "Pagamento cancelado nao pode ser confirmado.");
        if (pagamento.getConfiguracaoTipo() != TipoFormaPagamento.PIX)
            throw erro(HttpStatus.CONFLICT, "Confirmacao exige snapshot de pagamento PIX.");
        if (pagamento.getConfiguracaoContaFinanceiraDestinoId() == null)
            throw erro(HttpStatus.CONFLICT, "Pagamento sem destino financeiro historico.");
        if (pagamento.getValor() == null || pagamento.getValor().signum() <= 0)
            throw erro(HttpStatus.CONFLICT, "Pagamento deve possuir valor positivo.");
        var conta = contas.buscarParaAlterar(pagamento.getConfiguracaoContaFinanceiraDestinoId(), empresaId)
                .orElseThrow(() -> erro(HttpStatus.NOT_FOUND, "Conta financeira historica nao encontrada."));
        em.refresh(conta);
        if (movimentos.findByPagamentoIdAndEmpresaId(id, empresaId).isPresent())
            return PagamentoResponseDTO.de(pagamento);
        var usuario = usuarios.findByIdAndEmpresaId(usuarioId, empresaId)
                .orElseThrow(() -> erro(HttpStatus.NOT_FOUND, "Usuario nao encontrado."));
        var saldo = conta.getSaldoAtual().add(pagamento.getValor());
        if (saldo.precision() - saldo.scale() > 17)
            throw erro(HttpStatus.CONFLICT, "Saldo excede o limite permitido.");
        // Inativacao posterior nao muda o destino do recebimento historico.
        conta.aplicar(pagamento.getValor());
        contas.saveAndFlush(conta);
        var movimento = movimentos.saveAndFlush(MovimentacaoFinanceiraEntity.doPagamentoPix(pagamento, conta, usuario));
        pagamento.registrarConfirmacaoFinanceira(movimento);
        return PagamentoResponseDTO.de(pagamento);
    }

    // Chamado somente no cancelamento, sob locks de Venda e Pagamento.
    @Transactional(propagation = Propagation.MANDATORY)
    public void estornarNoCancelamento(PagamentoEntity pagamento, UsuarioEntity operador) {
        var movimento = movimentos.findByPagamentoIdAndEmpresaId(pagamento.getId(), pagamento.getEmpresa().getId()).orElse(null);
        if (movimento == null || movimento.isEstornada()) return;
        if (movimento.getOrigem() != OrigemMovimentacaoFinanceira.PAGAMENTO_PIX)
            throw erro(HttpStatus.CONFLICT, "Movimento incompativel com o cancelamento PIX.");
        var conta = contas.buscarParaAlterar(movimento.getContaFinanceira().getId(), pagamento.getEmpresa().getId())
                .orElseThrow(() -> erro(HttpStatus.NOT_FOUND, "Conta financeira historica nao encontrada."));
        // A associacao do movimento pode ter carregado o saldo antes da espera pelo lock.
        em.refresh(conta);
        if (conta.getSaldoAtual().compareTo(movimento.getValor()) < 0)
            throw erro(HttpStatus.CONFLICT, "Saldo insuficiente para estornar o recebimento PIX.");
        conta.aplicar(movimento.getValor().negate());
        contas.saveAndFlush(conta);
        movimento.estornar(operador, "Cancelamento da venda " + pagamento.getVenda().getId());
        movimentos.saveAndFlush(movimento);
    }

    private ResponseStatusException erro(HttpStatus status, String mensagem) { return new ResponseStatusException(status, mensagem); }
}
