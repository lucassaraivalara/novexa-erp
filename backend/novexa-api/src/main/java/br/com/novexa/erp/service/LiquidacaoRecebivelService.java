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
import java.time.LocalDate;
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
        return liquidarRegistros(java.util.List.of(id),empresaId,usuarioId,false,false).getFirst();
    }

    @Transactional
    public java.util.List<RecebivelResponseDTO> liquidarLote(java.util.List<Long> ids, Long empresaId, Long usuarioId) {
        return liquidarRegistros(ids,empresaId,usuarioId,true,false);
    }

    // O operador da venda identifica o registro automático, inclusive se depois for inativado.
    @Transactional
    public void liquidarAutomaticamente(Long id, Long empresaId) {
        var vinculo = recebiveis.buscarVinculosLote(List.of(id), empresaId);
        if (vinculo.isEmpty()) return;
        liquidarRegistros(List.of(id), empresaId, vinculo.getFirst().getUsuarioId(), false, true);
    }

    // Venda e operador já estão bloqueados. Antecipar a união de contas PIX/cartão mantém a ordem por ID.
    @Transactional(propagation = Propagation.MANDATORY)
    public void liquidarNoFaturamento(List<RecebivelEntity> criados, List<PagamentoEntity> pagamentosCriados, UsuarioEntity operador) {
        var imediatos = criados.stream().filter(r -> r.getPagamento().getModoRecebimentoSnapshot() == ModoRecebimentoFinanceiro.SIMPLIFICADO
                && Integer.valueOf(0).equals(r.getPrazoRecebimentoDiasSnapshot())).toList();
        if (imediatos.isEmpty()) return;
        var ids = new TreeSet<Long>();
        imediatos.forEach(r -> {
            var id = r.getPagamento().getConfiguracaoContaFinanceiraDestinoId();
            if (id == null) throw conflito("Pagamento sem destino financeiro histórico.");
            ids.add(id);
        });
        pagamentosCriados.stream().filter(p -> p.getConfiguracaoTipo() == TipoFormaPagamento.PIX
                && p.getModoRecebimentoSnapshot() == ModoRecebimentoFinanceiro.SIMPLIFICADO)
                .forEach(p -> {
                    var id = p.getConfiguracaoContaFinanceiraDestinoId();
                    if (id == null) throw conflito("Pagamento PIX sem destino financeiro histórico.");
                    ids.add(id);
                });
        var destinos = new TreeMap<Long, ContaFinanceiraEntity>();
        for (var id : ids) {
            var conta = contas.buscarParaAlterar(id, operador.getEmpresa().getId())
                    .orElseThrow(() -> conflito("Destino financeiro histórico inválido."));
            em.refresh(conta);
            destinos.put(id, conta);
        }
        for (var r : imediatos) {
            var conta = destinos.get(r.getPagamento().getConfiguracaoContaFinanceiraDestinoId());
            if (!conta.isAtivo() || (conta.getTipo() != TipoContaFinanceira.BANCO
                    && conta.getTipo() != TipoContaFinanceira.CARTEIRA_DIGITAL))
                throw conflito("Conta de destino do cartão indisponível. Revise a configuração de pagamento.");
            liquidarBloqueado(r, operador, destinos, true);
        }
    }

    private java.util.List<RecebivelResponseDTO> liquidarRegistros(java.util.List<Long> ids,Long empresaId,Long usuarioId,
            boolean lote, boolean automatico) {
        if (ids==null || ids.isEmpty() || ids.size()>200 || ids.stream().anyMatch(id -> id==null || id<=0)
                || ids.stream().distinct().count()!=ids.size())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Selecione entre 1 e 200 recebíveis distintos.");
        var usuario=vendas.bloquearOperador(usuarioId,empresaId).orElseThrow(() -> naoEncontrado("Usuário"));
        if ((!automatico && !Boolean.TRUE.equals(usuario.getAtivo())) || !Boolean.TRUE.equals(usuario.getEmpresa().getAtivo()))
            throw conflito("Operador indisponível para liquidação.");
        if (lote && usuario.getPerfil()!=PerfilUsuario.ADMIN && usuario.getPerfil()!=PerfilUsuario.GERENTE)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Somente administradores e gestores podem liquidar lotes.");
        if (lote && usuario.getEmpresa().getModoRecebimentoFinanceiro()!=ModoRecebimentoFinanceiro.SIMPLIFICADO)
            throw conflito("A liquidação agrupada está disponível no modo Simplificado.");
        var ordenados=ids.stream().sorted().toList();
        var vinculos=recebiveis.buscarVinculosLote(ordenados,empresaId);
        if (vinculos.size()!=ordenados.size()) throw naoEncontrado("Recebível");
        // All aggregates before any financial account. Deterministic ordering also for overlapping batches.
        for (var vendaId : vinculos.stream().map(RecebivelRepository.Vinculos::getVendaId).distinct().sorted().toList()) {
            var venda=vendas.findByIdAndEmpresaIdWithLock(vendaId,empresaId).orElseThrow(() -> naoEncontrado("Venda")); em.refresh(venda);
        }
        for (var pagamentoId : vinculos.stream().map(RecebivelRepository.Vinculos::getPagamentoId).distinct().sorted().toList()) {
            var pagamento=pagamentos.buscarParaConfirmar(pagamentoId,empresaId).orElseThrow(() -> naoEncontrado("Pagamento")); em.refresh(pagamento);
        }
        var registros=new java.util.ArrayList<RecebivelEntity>();
        for (var id : ordenados) {
            var r=recebiveis.buscarParaLiquidar(id,empresaId).orElseThrow(() -> naoEncontrado("Recebível")); em.refresh(r); registros.add(r);
        }
        var destinos=new java.util.TreeMap<Long,ContaFinanceiraEntity>();
        for (var destinoId : registros.stream().map(r -> r.getPagamento().getConfiguracaoContaFinanceiraDestinoId())
                .filter(java.util.Objects::nonNull).distinct().sorted().toList()) {
            var conta=contas.buscarParaAlterar(destinoId,empresaId).orElseThrow(() -> conflito("Destino financeiro histórico inválido."));
            em.refresh(conta); destinos.put(destinoId,conta);
        }
        if (automatico && registros.stream().anyMatch(r -> r.getPagamento().getModoRecebimentoSnapshot() != ModoRecebimentoFinanceiro.SIMPLIFICADO
                || r.getDataPrevistaRecebimento() == null || r.getDataPrevistaRecebimento().isAfter(LocalDate.now())))
            throw conflito("Recebível ainda não elegível para liquidação automática.");
        return registros.stream().map(r -> liquidarBloqueado(r,usuario,destinos,automatico)).toList();
    }

    private RecebivelResponseDTO liquidarBloqueado(RecebivelEntity r, UsuarioEntity usuario,
            Map<Long,ContaFinanceiraEntity> destinos, boolean automatico) {
        var id=r.getId(); var empresaId=r.getEmpresa().getId(); var venda=r.getVenda(); var pagamento=r.getPagamento();
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
        var conta = destinos.get(destinoId);
        if (conta == null) throw conflito("Destino financeiro historico invalido.");
        var valor = r.getValorLiquidoPrevisto();
        if (valor == null || valor.signum() <= 0 || valor.compareTo(r.getValorBruto()) > 0)
            throw conflito("Valor liquido previsto invalido para liquidacao integral.");
        validarSaldo(conta.getSaldoAtual().add(valor));
        var movimento = movimentos.saveAndFlush(MovimentacaoFinanceiraEntity.doRecebivel(r, conta, usuario, automatico));
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
