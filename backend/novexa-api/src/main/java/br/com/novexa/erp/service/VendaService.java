package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional
public class VendaService {
    private final VendaRepository vendas;
    private final ClienteRepository clientes;
    private final MovimentacaoEstoqueRepository movimentos;
    private final LancamentoFinanceiroRepository financeiro;

    public VendaService(VendaRepository vendas, ClienteRepository clientes,
                        MovimentacaoEstoqueRepository movimentos, LancamentoFinanceiroRepository financeiro) {
        this.vendas = vendas; this.clientes = clientes; this.movimentos = movimentos; this.financeiro = financeiro;
    }

    public VendaResponseDTO finalizar(VendaRequestDTO pedido, UsuarioAutenticado autenticado) {
        UsuarioEntity operador = vendas.bloquearOperador(autenticado.usuarioId(), autenticado.empresaId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Operador não disponível para venda."));
        if (Boolean.FALSE.equals(operador.getAtivo()) || !Boolean.TRUE.equals(operador.getEmpresa().getAtivo())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Operador ou empresa inativa.");
        }
        String resumo = resumo(pedido);
        var existente = vendas.findByEmpresaIdAndUsuarioIdAndChaveRequisicao(
                autenticado.empresaId(), autenticado.usuarioId(), pedido.chaveRequisicao());
        if (existente.isPresent()) {
            if (!existente.get().getResumoRequisicao().equals(resumo)) {
                throw conflito("Esta finalização já foi utilizada com outros dados.");
            }
            return VendaResponseDTO.de(existente.get());
        }

        ClienteEntity cliente = pedido.clienteId() == null ? null : clientes
                .findByIdAndEmpresaId(pedido.clienteId(), autenticado.empresaId())
                .filter(c -> Boolean.TRUE.equals(c.getAtivo()))
                .orElseThrow(() -> conflito("Cliente indisponível para esta empresa."));
        List<Long> ids = pedido.itens().stream().map(VendaRequestDTO.Item::produtoId).toList();
        if (new HashSet<>(ids).size() != ids.size()) throw conflito("Agrupe as quantidades do mesmo produto.");
        Map<Long, ProdutoEntity> produtos = vendas.bloquearProdutos(autenticado.empresaId(), ids).stream()
                .collect(Collectors.toMap(ProdutoEntity::getId, Function.identity()));
        if (produtos.size() != ids.size()) throw conflito("Produto indisponível para esta empresa.");

        BigDecimal subtotal = BigDecimal.ZERO;
        for (var item : pedido.itens()) {
            ProdutoEntity produto = produtos.get(item.produtoId());
            if (!Boolean.TRUE.equals(produto.getAtivo())) throw conflito("Produto inativo: " + produto.getNome());
            if (produto.getPrecoVenda().compareTo(item.precoUnitarioEsperado()) != 0) {
                throw conflito("Preço alterado: " + produto.getNome() + ". Remova e adicione o item novamente.");
            }
            if (Boolean.TRUE.equals(produto.getControlaEstoque()) && produto.getEstoqueAtual().compareTo(item.quantidade()) < 0) {
                throw conflito("Estoque insuficiente: " + produto.getNome() + ". Disponível: " + produto.getEstoqueAtual());
            }
            subtotal = subtotal.add(subtotal(produto, item));
        }
        BigDecimal total = subtotal.subtract(pedido.desconto()).setScale(2, RoundingMode.HALF_UP);
        if (total.signum() <= 0) throw conflito("O desconto deve ser menor que o subtotal da venda.");
        if (total.compareTo(pedido.totalEsperado()) != 0) throw conflito("O total mudou. Revise os itens antes de finalizar.");
        BigDecimal recebido = pedido.valorRecebido();
        if (recebido.compareTo(total) < 0) throw conflito("O valor recebido é menor que o total.");
        if (pedido.formaPagamento() != FormaPagamento.DINHEIRO && recebido.compareTo(total) != 0) {
            throw conflito("PIX e cartão devem corresponder ao total da venda, sem troco.");
        }
        VendaEntity venda = vendas.save(new VendaEntity(operador, cliente, pedido.chaveRequisicao(), resumo,
                subtotal, pedido.desconto(), total, pedido.formaPagamento(), recebido, recebido.subtract(total),
                pedido.entrega(), pedido.observacoes()));

        for (var item : pedido.itens()) {
            ProdutoEntity produto = produtos.get(item.produtoId());
            Long movimentoId = null;
            if (Boolean.TRUE.equals(produto.getControlaEstoque())) {
                var movimento = new MovimentacaoEstoqueEntity();
                movimento.setEmpresa(operador.getEmpresa()); movimento.setUsuario(operador); movimento.setProduto(produto);
                movimento.setTipo(TipoMovimentacaoEstoque.SAIDA); movimento.setOrigem(OrigemMovimentacaoEstoque.VENDA);
                movimento.setQuantidade(item.quantidade()); movimento.setSaldoAnterior(produto.getEstoqueAtual());
                produto.setEstoqueAtual(produto.getEstoqueAtual().subtract(item.quantidade()));
                movimento.setSaldoPosterior(produto.getEstoqueAtual()); movimento.setMotivo("Venda " + venda.getId());
                movimentoId = movimentos.save(movimento).getId();
            }
            venda.getItens().add(new VendaItem(produto, item.quantidade(), subtotal(produto, item), movimentoId));
        }
        // Se qualquer gravação falhar, venda, saldo, histórico e financeiro são revertidos juntos.
        financeiro.save(new LancamentoFinanceiroEntity(venda));
        return VendaResponseDTO.de(venda);
    }

    @Transactional(readOnly = true)
    public VendaResponseDTO buscar(Long id, Long empresaId) {
        return VendaResponseDTO.de(vendas.findByIdAndEmpresaId(id, empresaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Venda não encontrada.")));
    }

    private BigDecimal subtotal(ProdutoEntity produto, VendaRequestDTO.Item item) {
        return produto.getPrecoVenda().multiply(item.quantidade()).setScale(2, RoundingMode.HALF_UP);
    }
    private ResponseStatusException conflito(String mensagem) {
        return new ResponseStatusException(HttpStatus.CONFLICT, mensagem);
    }
    private String resumo(VendaRequestDTO pedido) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(pedido.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
