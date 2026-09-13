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
    private final ItemVendaRepository itensVenda;
    private final ProdutoRepository produtos;
    private final MovimentacaoEstoqueRepository movimentos;
    private final LancamentoFinanceiroRepository financeiro;

    public VendaService(VendaRepository vendas, ClienteRepository clientes,
                        ItemVendaRepository itensVenda, ProdutoRepository produtos,
                        MovimentacaoEstoqueRepository movimentos,
                        LancamentoFinanceiroRepository financeiro) {
        this.vendas = vendas; this.clientes = clientes; this.itensVenda = itensVenda;
        this.produtos = produtos; this.movimentos = movimentos; this.financeiro = financeiro;
    }

    public VendaResponseDTO criarVendaAberta(UsuarioAutenticado autenticado) {
        UsuarioEntity operador = vendas.bloquearOperador(autenticado.usuarioId(), autenticado.empresaId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Operador não disponível para venda."));
        if (Boolean.FALSE.equals(operador.getAtivo()) || !Boolean.TRUE.equals(operador.getEmpresa().getAtivo())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Operador ou empresa inativa.");
        }
        VendaEntity venda = new VendaEntity(operador, null);
        vendas.save(venda);
        return VendaResponseDTO.de(venda);
    }

    public VendaResponseDTO adicionarItem(Long vendaId, Long produtoId, BigDecimal quantidade,
                                          UsuarioAutenticado autenticado) {
        VendaEntity venda = buscarVendaAberta(vendaId, autenticado.empresaId());
        ProdutoEntity produto = produtos.findByIdAndEmpresaId(produtoId, autenticado.empresaId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Produto não encontrado para a empresa informada."));
        if (!Boolean.TRUE.equals(produto.getAtivo())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Produto inativo.");
        }
        if (quantidade == null || quantidade.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Quantidade deve ser maior que zero.");
        }
        Optional<ItemVendaEntity> existente = itensVenda.findByVendaId(vendaId).stream()
                .filter(i -> i.getProduto().getId().equals(produtoId)).findFirst();
        if (existente.isPresent()) {
            ItemVendaEntity item = existente.get();
            item.setQuantidade(item.getQuantidade().add(quantidade));
            item.setSubtotal(item.getQuantidade().multiply(item.getPrecoUnitario()).setScale(2, RoundingMode.HALF_UP));
            itensVenda.save(item);
        } else {
            ItemVendaEntity item = new ItemVendaEntity(venda, produto, quantidade,
                    produto.getPrecoVenda(), quantidade.multiply(produto.getPrecoVenda()).setScale(2, RoundingMode.HALF_UP));
            itensVenda.save(item);
        }
        recalcularTotais(venda);
        return VendaResponseDTO.de(venda);
    }

    public VendaResponseDTO alterarQuantidade(Long vendaId, Long itemId, BigDecimal quantidade,
                                               UsuarioAutenticado autenticado) {
        VendaEntity venda = buscarVendaAberta(vendaId, autenticado.empresaId());
        ItemVendaEntity item = itensVenda.findById(itemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item não encontrado."));
        if (!item.getVenda().getId().equals(vendaId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item não pertence a esta venda.");
        }
        if (quantidade == null || quantidade.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Quantidade deve ser maior que zero.");
        }
        item.setQuantidade(quantidade);
        item.setSubtotal(quantidade.multiply(item.getPrecoUnitario()).setScale(2, RoundingMode.HALF_UP));
        itensVenda.save(item);
        recalcularTotais(venda);
        return VendaResponseDTO.de(venda);
    }

    public VendaResponseDTO removerItem(Long vendaId, Long itemId, UsuarioAutenticado autenticado) {
        VendaEntity venda = buscarVendaAberta(vendaId, autenticado.empresaId());
        ItemVendaEntity item = itensVenda.findById(itemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item não encontrado."));
        if (!item.getVenda().getId().equals(vendaId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item não pertence a esta venda.");
        }
        itensVenda.delete(item);
        recalcularTotais(venda);
        return VendaResponseDTO.de(venda);
    }

    public VendaResponseDTO aplicarDesconto(Long vendaId, BigDecimal desconto, UsuarioAutenticado autenticado) {
        VendaEntity venda = buscarVendaAberta(vendaId, autenticado.empresaId());
        BigDecimal subtotal = calcularSubtotal(venda);
        if (desconto == null || desconto.compareTo(BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Desconto não pode ser negativo.");
        }
        if (desconto.compareTo(subtotal) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Desconto não pode ser maior que o subtotal.");
        }
        venda.setDesconto(desconto);
        venda.setTotal(subtotal.subtract(desconto).setScale(2, RoundingMode.HALF_UP));
        vendas.save(venda);
        return VendaResponseDTO.de(venda);
    }

    public VendaResponseDTO vincularCliente(Long vendaId, Long clienteId, UsuarioAutenticado autenticado) {
        VendaEntity venda = buscarVendaAberta(vendaId, autenticado.empresaId());
        ClienteEntity cliente = clientes.findByIdAndEmpresaId(clienteId, autenticado.empresaId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cliente não encontrado para a empresa informada."));
        venda.setCliente(cliente);
        vendas.save(venda);
        return VendaResponseDTO.de(venda);
    }

    public VendaResponseDTO removerCliente(Long vendaId, UsuarioAutenticado autenticado) {
        VendaEntity venda = buscarVendaAberta(vendaId, autenticado.empresaId());
        venda.setCliente(null);
        vendas.save(venda);
        return VendaResponseDTO.de(venda);
    }

    @Transactional(readOnly = true)
    public VendaResponseDTO buscar(Long id, Long empresaId) {
        return VendaResponseDTO.de(vendas.findByIdAndEmpresaId(id, empresaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Venda não encontrada.")));
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
        Map<Long, ProdutoEntity> produtosMap = vendas.bloquearProdutos(autenticado.empresaId(), ids).stream()
                .collect(Collectors.toMap(ProdutoEntity::getId, Function.identity()));
        if (produtosMap.size() != ids.size()) throw conflito("Produto indisponível para esta empresa.");

        BigDecimal subtotal = BigDecimal.ZERO;
        for (var item : pedido.itens()) {
            ProdutoEntity produto = produtosMap.get(item.produtoId());
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
            ProdutoEntity produto = produtosMap.get(item.produtoId());
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
        financeiro.save(new LancamentoFinanceiroEntity(venda));
        return VendaResponseDTO.de(venda);
    }

    private void recalcularTotais(VendaEntity venda) {
        BigDecimal subtotal = calcularSubtotal(venda);
        BigDecimal desconto = venda.getDesconto() != null ? venda.getDesconto() : BigDecimal.ZERO;
        BigDecimal total = subtotal.subtract(desconto).setScale(2, RoundingMode.HALF_UP);
        venda.setSubtotal(subtotal);
        venda.setTotal(total);
        vendas.save(venda);
    }

    private BigDecimal calcularSubtotal(VendaEntity venda) {
        List<ItemVendaEntity> itens = itensVenda.findByVendaId(venda.getId());
        BigDecimal sum = BigDecimal.ZERO;
        for (ItemVendaEntity item : itens) {
            sum = sum.add(item.getSubtotal());
        }
        return sum.setScale(2, RoundingMode.HALF_UP);
    }

    private VendaEntity buscarVendaAberta(Long vendaId, Long empresaId) {
        VendaEntity venda = vendas.findByIdAndEmpresaId(vendaId, empresaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Venda não encontrada."));
        if (venda.getStatus() != StatusVenda.ABERTA) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Apenas vendas ABERTA podem ser alteradas.");
        }
        return venda;
    }

    private BigDecimal subtotal(ProdutoEntity produto, VendaRequestDTO.Item item) {
        return produto.getPrecoVenda().multiply(item.quantidade()).setScale(2, RoundingMode.HALF_UP);
    }

    private ResponseStatusException conflito(String mensagem) {
        return new ResponseStatusException(HttpStatus.CONFLICT, mensagem);
    }

    private String resumo(VendaRequestDTO pedido) {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256")
                    .digest(pedido.toString().getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
