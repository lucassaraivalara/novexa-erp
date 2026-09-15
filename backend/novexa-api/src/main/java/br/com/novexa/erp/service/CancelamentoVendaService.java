package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.VendaResponseDTO;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import jakarta.persistence.EntityManager;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

/**
 * Cancelamento integral: estoque, Pagamento, Caixa e lançamento financeiro na mesma transação.
 */
@Service
public class CancelamentoVendaService {
    private final VendaRepository vendas;
    private final MovimentacaoEstoqueRepository movimentos;
    private final MovimentacaoEstoqueService estoque;
    private final EntityManager em;
    private final PagamentoService pagamentos;

    public CancelamentoVendaService(VendaRepository vendas, MovimentacaoEstoqueRepository movimentos,
            MovimentacaoEstoqueService estoque, EntityManager em, PagamentoService pagamentos) {
        this.vendas = vendas; this.movimentos = movimentos; this.estoque = estoque; this.em = em; this.pagamentos = pagamentos;
    }

    @Transactional
    public VendaResponseDTO cancelarVendaFaturada(Long vendaId, UsuarioAutenticado autenticado) {
        // Mesma ordem do faturamento: operador, Venda, produtos em ordem de ID.
        var operador = vendas.bloquearOperador(autenticado.usuarioId(), autenticado.empresaId())
                .filter(u -> Boolean.TRUE.equals(u.getAtivo()) && Boolean.TRUE.equals(u.getEmpresa().getAtivo()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Operador indisponível."));
        var venda = vendas.findByIdAndEmpresaIdWithLock(vendaId, autenticado.empresaId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Venda não encontrada."));
        em.refresh(venda);
        if (venda.getStatus() == StatusVenda.CANCELADA) return VendaResponseDTO.de(venda);
        if (venda.getStatus() != StatusVenda.FATURADA)
            throw conflito("Somente venda FATURADA pode ser cancelada.");

        List<MovimentacaoEstoqueEntity> originais = new ArrayList<>();
        Set<Long> idsMovimentos = new HashSet<>();
        for (var item : venda.getItens()) {
            // Ausência de baixa significa item vendido sem controle: não inventar entrada.
            if (item.getMovimentacaoEstoqueId() == null) continue;
            var original = movimentos.findById(item.getMovimentacaoEstoqueId())
                    .orElseThrow(() -> conflito("Saída original do item não encontrada."));
            if (!Objects.equals(original.getEmpresa().getId(), autenticado.empresaId())
                    || !Objects.equals(original.getProduto().getId(), item.getProduto().getId())
                    || original.getTipo() != TipoMovimentacaoEstoque.SAIDA
                    || original.getOrigem() != OrigemMovimentacaoEstoque.VENDA
                    || original.getQuantidade().signum() <= 0
                    || original.getQuantidade().compareTo(item.getQuantidade()) != 0
                    || original.getSaldoAnterior().subtract(original.getSaldoPosterior()).compareTo(original.getQuantidade()) != 0
                    || !idsMovimentos.add(original.getId()))
                throw conflito("Saída original incompatível com o item da venda.");
            originais.add(original);
        }
        var idsProdutos = originais.stream().map(m -> m.getProduto().getId()).distinct().sorted().toList();
        if (!idsProdutos.isEmpty()) {
            var produtos = vendas.bloquearProdutos(autenticado.empresaId(), idsProdutos);
            if (produtos.size() != idsProdutos.size()) throw conflito("Produto indisponível para esta empresa.");
            // Itens/histórico podem ter carregado o saldo antes da aquisição do lock.
            produtos.forEach(em::refresh);
        }
        for (var original : originais) {
            estoque.reverterSaidaVenda(original, operador.getId(),
                    "Cancelamento da venda " + venda.getId() + "; reversão da movimentação " + original.getId());
        }
        pagamentos.cancelarFaturamento(venda, operador);
        venda.setStatus(StatusVenda.CANCELADA);
        vendas.saveAndFlush(venda);
        return VendaResponseDTO.de(venda);
    }

    private ResponseStatusException conflito(String mensagem) {
        return new ResponseStatusException(HttpStatus.CONFLICT, mensagem);
    }
}
