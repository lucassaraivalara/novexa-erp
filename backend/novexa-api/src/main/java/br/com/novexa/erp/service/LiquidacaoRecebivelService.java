package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.RecebivelResponseDTO;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import jakarta.persistence.EntityManager;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.util.*;

@Service
public class LiquidacaoRecebivelService {
    private final RecebivelRepository recebiveis;
    private final VendaRepository vendas;
    private final PagamentoRepository pagamentos;
    private final ContaFinanceiraRepository contas;
    private final MovimentacaoFinanceiraRepository movimentos;
    private final EntityManager em;

    public LiquidacaoRecebivelService(RecebivelRepository recebiveis, VendaRepository vendas, PagamentoRepository pagamentos,
            ContaFinanceiraRepository contas, MovimentacaoFinanceiraRepository movimentos, EntityManager em) {
        this.recebiveis = recebiveis; this.vendas = vendas; this.pagamentos = pagamentos;
        this.contas = contas; this.movimentos = movimentos; this.em = em;
    }

    @Transactional
    public RecebivelResponseDTO liquidar(Long id, Long empresaId, Long usuarioId) {
        var vinculos = recebiveis.buscarVinculos(id, empresaId).orElseThrow(() -> naoEncontrado("Recebivel"));
        // Compatibilidade com PIX/cancelamento: operador -> Venda -> Pagamento -> Recebivel -> Conta.
        var usuario = vendas.bloquearOperador(usuarioId, empresaId).orElseThrow(() -> naoEncontrado("Usuario"));
        if (!Boolean.TRUE.equals(usuario.getAtivo()) || !Boolean.TRUE.equals(usuario.getEmpresa().getAtivo()))
            throw conflito("Operador indisponivel para liquidacao.");
        var venda = vendas.findByIdAndEmpresaIdWithLock(vinculos.getVendaId(), empresaId).orElseThrow(() -> naoEncontrado("Venda"));
        em.refresh(venda);
        var pagamento = pagamentos.buscarParaConfirmar(vinculos.getPagamentoId(), empresaId).orElseThrow(() -> naoEncontrado("Pagamento"));
        em.refresh(pagamento);
        var r = recebiveis.buscarParaLiquidar(id, empresaId).orElseThrow(() -> naoEncontrado("Recebivel"));
        em.refresh(r);
        if (venda.getStatus() != StatusVenda.FATURADA || pagamento.getStatus() != StatusPagamento.REGISTRADO
                || r.getStatus() == StatusRecebivel.CANCELADO)
            throw conflito("Recebivel ou venda cancelados nao podem ser liquidados.");
        var anterior = movimentos.findByRecebivelIdAndEmpresaId(id, empresaId).orElse(null);
        if (r.getStatus() == StatusRecebivel.LIQUIDADO) {
            validarMovimento(r, anterior);
            return RecebivelResponseDTO.de(r, anterior.getId());
        }
        if (anterior != null) throw conflito("Recebivel pendente possui movimentacao financeira.");
        var destinoId = pagamento.getConfiguracaoContaFinanceiraDestinoId();
        if (destinoId == null) throw conflito("Pagamento sem destino financeiro historico.");
        var conta = contas.buscarParaAlterar(destinoId, empresaId).orElseThrow(() -> conflito("Destino financeiro historico invalido."));
        em.refresh(conta);
        var valor = r.getValorLiquidoPrevisto();
        if (valor == null || valor.signum() <= 0 || valor.compareTo(r.getValorBruto()) > 0)
            throw conflito("Valor liquido previsto invalido para liquidacao integral.");
        validarSaldo(conta.getSaldoAtual().add(valor));
        var movimento = movimentos.saveAndFlush(MovimentacaoFinanceiraEntity.doRecebivel(r, conta, usuario));
        conta.aplicar(valor);
        contas.saveAndFlush(conta);
        r.liquidar(movimento);
        recebiveis.saveAndFlush(r);
        return RecebivelResponseDTO.de(r, movimento.getId());
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void cancelar(VendaEntity venda, UsuarioEntity usuario) {
        var empresaId = venda.getEmpresa().getId();
        // Venda/operador ja bloqueados pelo cancelamento; Pagamentos e Recebiveis por ID crescente.
        pagamentos.buscarParaCancelar(empresaId, venda.getId());
        var registros = recebiveis.buscarParaCancelar(empresaId, venda.getId());
        registros.forEach(em::refresh);
        Map<Long, MovimentacaoFinanceiraEntity> efeitos = new HashMap<>();
        Map<Long, BigDecimal> debitos = new TreeMap<>();
        for (var r : registros) {
            var m = movimentos.findByRecebivelIdAndEmpresaId(r.getId(), empresaId).orElse(null);
            if (r.getStatus() == StatusRecebivel.LIQUIDADO) {
                validarMovimento(r, m);
                efeitos.put(r.getId(), m);
                debitos.merge(m.getContaFinanceira().getId(), m.getValor(), BigDecimal::add);
            } else if (r.getStatus() == StatusRecebivel.PENDENTE && m != null)
                throw conflito("Recebivel pendente possui movimentacao financeira.");
        }
        // Bloquear todas as contas na mesma ordem das transferencias antes de aplicar efeitos.
        Map<Long, ContaFinanceiraEntity> destinos = new HashMap<>();
        for (var debito : debitos.entrySet()) {
            var conta = contas.buscarParaAlterar(debito.getKey(), empresaId).orElseThrow(() -> naoEncontrado("Conta financeira"));
            em.refresh(conta);
            validarSaldo(conta.getSaldoAtual().subtract(debito.getValue()));
            destinos.put(debito.getKey(), conta);
        }
        for (var debito : debitos.entrySet()) {
            var conta = destinos.get(debito.getKey()); conta.aplicar(debito.getValue().negate()); contas.saveAndFlush(conta);
        }
        for (var r : registros) {
            var movimento = efeitos.get(r.getId());
            if (movimento != null) {
                movimento.estornar(usuario, "Cancelamento da venda " + venda.getId());
                movimentos.saveAndFlush(movimento);
            }
            r.cancelar(usuario);
        }
        recebiveis.saveAllAndFlush(registros);
    }

    private void validarMovimento(RecebivelEntity r, MovimentacaoFinanceiraEntity m) {
        if (m == null || m.isEstornada() || m.getOrigem() != OrigemMovimentacaoFinanceira.RECEBIVEL_LIQUIDACAO
                || m.getTipo() != TipoMovimentacaoFinanceira.ENTRADA || r.getValorLiquidoRecebido() == null
                || m.getValor().compareTo(r.getValorLiquidoRecebido()) != 0
                || !m.getContaFinanceira().getId().equals(r.getPagamento().getConfiguracaoContaFinanceiraDestinoId()))
            throw conflito("Historico financeiro do recebivel inconsistente.");
    }
    private void validarSaldo(BigDecimal saldo) {
        if (saldo.signum() < 0) throw conflito("Saldo insuficiente para reverter a liquidacao.");
        if (saldo.precision() - saldo.scale() > 17) throw conflito("Saldo excede o limite permitido.");
    }
    private ResponseStatusException conflito(String mensagem) { return new ResponseStatusException(HttpStatus.CONFLICT, mensagem); }
    private ResponseStatusException naoEncontrado(String objeto) { return new ResponseStatusException(HttpStatus.NOT_FOUND, objeto + " nao encontrado."); }
}
