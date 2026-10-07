package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.LocalDateTime;
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
    private final MovimentacaoEstoqueService estoque;
    private final PagamentoService pagamentos;
    private final RecebivelService recebiveis;
    private final ContaReceberService contasReceber;
    private final CaixaOperacionalService caixaOperacional;
    @PersistenceContext private EntityManager entityManager;

    public VendaService(VendaRepository vendas, ClienteRepository clientes,
                        ItemVendaRepository itensVenda, ProdutoRepository produtos,
                        MovimentacaoEstoqueService estoque,
                        PagamentoService pagamentos, CaixaOperacionalService caixaOperacional, RecebivelService recebiveis,
                        ContaReceberService contasReceber) {
        this.vendas = vendas; this.clientes = clientes; this.itensVenda = itensVenda;
        this.produtos = produtos; this.estoque = estoque;
        this.pagamentos = pagamentos;
        this.recebiveis = recebiveis;
        this.contasReceber = contasReceber;
        this.caixaOperacional = caixaOperacional;
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
        validarQuantidade(quantidade);
        Optional<ItemVendaEntity> existente = venda.getItens().stream()
                .filter(i -> i.getProduto().getId().equals(produtoId)).findFirst();
        if (existente.isPresent()) {
            ItemVendaEntity item = existente.get();
            item.setQuantidade(item.getQuantidade().add(quantidade));
            item.setSubtotal(item.getQuantidade().multiply(item.getPrecoUnitario()).setScale(2, RoundingMode.HALF_UP));
            itensVenda.save(item);
        } else {
            ItemVendaEntity item = new ItemVendaEntity(venda, produto, quantidade,
                    produto.getPrecoVenda(), quantidade.multiply(produto.getPrecoVenda()).setScale(2, RoundingMode.HALF_UP));
            item.setOrdem(venda.getItens().stream().mapToInt(ItemVendaEntity::getOrdem).max().orElse(-1) + 1);
            itensVenda.save(item);
            venda.getItens().add(item);
        }
        recalcularTotais(venda);
        return VendaResponseDTO.de(venda);
    }

    public VendaResponseDTO alterarQuantidade(Long vendaId, Long itemId, BigDecimal quantidade,
                                               UsuarioAutenticado autenticado) {
        VendaEntity venda = buscarVendaAberta(vendaId, autenticado.empresaId());
        ItemVendaEntity item = itensVenda.findByIdAndVendaEmpresaId(itemId, autenticado.empresaId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item não encontrado."));
        if (!item.getVenda().getId().equals(vendaId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item não pertence a esta venda.");
        }
        validarQuantidade(quantidade);
        item.setQuantidade(quantidade);
        item.setSubtotal(quantidade.multiply(item.getPrecoUnitario()).setScale(2, RoundingMode.HALF_UP));
        itensVenda.save(item);
        recalcularTotais(venda);
        return VendaResponseDTO.de(venda);
    }

    public VendaResponseDTO removerItem(Long vendaId, Long itemId, UsuarioAutenticado autenticado) {
        VendaEntity venda = buscarVendaAberta(vendaId, autenticado.empresaId());
        ItemVendaEntity item = itensVenda.findByIdAndVendaEmpresaId(itemId, autenticado.empresaId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item não encontrado."));
        if (!item.getVenda().getId().equals(vendaId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item não pertence a esta venda.");
        }
        venda.getItens().remove(item);
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
        if (!Boolean.TRUE.equals(cliente.getAtivo()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cliente inativo.");
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

    @Transactional(readOnly = true)
    public List<VendaResumoDTO> listar(Long empresaId, StatusVenda status, LocalDate dataInicial,
                                       LocalDate dataFinal, Long clienteId) {
        if (dataInicial != null && dataFinal != null && dataInicial.isAfter(dataFinal)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "dataInicial não pode ser posterior a dataFinal.");
        }
        LocalDateTime inicio = dataInicial == null ? null : dataInicial.atStartOfDay();
        LocalDateTime fimExclusivo = dataFinal == null ? null : dataFinal.plusDays(1).atStartOfDay();
        return vendas.listarResumo(empresaId, status, inicio, fimExclusivo, clienteId)
                .stream().map(VendaResumoDTO::de).toList();
    }

    @Transactional(readOnly = true)
    public PaginaResponseDTO<VendaResumoDTO> listarPaginado(Long empresaId, StatusVenda status,
                                                            LocalDate dataInicial, LocalDate dataFinal,
                                                            Long clienteId, int page, int size, String sort) {
        if (dataInicial != null && dataFinal != null && dataInicial.isAfter(dataFinal)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "dataInicial não pode ser posterior a dataFinal.");
        }
        if (page < 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "page deve ser >= 0");
        if (size < 1) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "size deve ser >= 1");
        if (size > 100) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "size máximo é 100");

        LocalDateTime inicio = dataInicial == null ? null : dataInicial.atStartOfDay();
        LocalDateTime fimExclusivo = dataFinal == null ? null : dataFinal.plusDays(1).atStartOfDay();

        Pageable pageable = br.com.novexa.erp.util.Paginacao.criar(page, size, sort,
                java.util.Set.of("id", "dataHora", "total", "status"), org.springframework.data.domain.Sort.Direction.DESC);
        var pageResult = vendas.listarResumoPaginado(empresaId, status, inicio, fimExclusivo, clienteId, pageable);
        return PaginaResponseDTO.de(pageResult, VendaResumoDTO::de);
    }

    @Transactional(readOnly = true)
    public List<VendaResponseDTO> listarPorSessao(Long empresaId, Long sessaoId) {
        return vendas.findByEmpresaIdAndSessaoCaixaIdAndStatusOrderByDataHoraAscIdAsc(empresaId, sessaoId, StatusVenda.FATURADA)
                .stream().map(VendaResponseDTO::de).toList();
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
        Map<Long, ProdutoEntity> produtosMap = bloquearProdutos(autenticado.empresaId(), ids);
        BigDecimal subtotal = BigDecimal.ZERO;
        for (var item : pedido.itens()) {
            ProdutoEntity produto = produtosMap.get(item.produtoId());
            if (produto.getPrecoVenda().compareTo(item.precoUnitarioEsperado()) != 0) {
                throw conflito("Preço alterado: " + produto.getNome() + ". Remova e adicione o item novamente.");
            }
            validarQuantidade(item.quantidade());
            subtotal = subtotal.add(subtotal(produto, item));
        }
        VendaEntity venda = vendas.save(new VendaEntity(operador, cliente, pedido.chaveRequisicao(), resumo,
                subtotal, pedido.desconto(), subtotal.subtract(pedido.desconto()), null, null, null,
                pedido.entrega(), pedido.observacoes()));
        for (var item : pedido.itens()) {
            ProdutoEntity produto = produtosMap.get(item.produtoId());
            var novo = new ItemVendaEntity(venda, produto, item.quantidade(), produto.getPrecoVenda(),
                    subtotal(produto, item), null, venda.getItens().size());
            itensVenda.save(novo);
            venda.getItens().add(novo);
        }
        return faturar(venda, new FaturamentoVendaDTO(pedido.chaveRequisicao(), pedido.totalEsperado(),
                pedido.formaPagamento(), pedido.valorRecebido(), pedido.formaPagamentoId(), pedido.sessaoCaixaId(),
                pedido.configuracaoFormaPagamentoId(), pedido.pagamentos(), pedido.parcelasPrazo()), autenticado, operador, resumo, produtosMap);
    }

    public VendaResponseDTO faturar(Long vendaId, FaturamentoVendaDTO pedido, UsuarioAutenticado autenticado) {
        UsuarioEntity operador = vendas.bloquearOperador(autenticado.usuarioId(), autenticado.empresaId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Operador não disponível para venda."));
        if (Boolean.FALSE.equals(operador.getAtivo()) || !Boolean.TRUE.equals(operador.getEmpresa().getAtivo())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Operador ou empresa inativa.");
        }
        VendaEntity venda = vendas.findByIdAndEmpresaIdWithLock(vendaId, autenticado.empresaId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Venda não encontrada."));
        String resumo = resumo("faturamento:" + pedido);
        if (venda.getStatus() == StatusVenda.FATURADA
                && Objects.equals(venda.getChaveRequisicao(), pedido.chaveRequisicao())
                && Objects.equals(venda.getResumoRequisicao(), resumo)) {
            return VendaResponseDTO.de(venda);
        }
        if (venda.getStatus() != StatusVenda.ABERTA) throw conflito("Apenas vendas ABERTA podem ser faturadas.");
        var repetida = vendas.findByEmpresaIdAndUsuarioIdAndChaveRequisicao(
                venda.getEmpresa().getId(), venda.getUsuario().getId(), pedido.chaveRequisicao());
        if (repetida.isPresent() && !repetida.get().getId().equals(vendaId)) {
            throw conflito("Esta finalização já foi utilizada em outra venda.");
        }
        List<Long> ids = venda.getItens().stream().map(i -> i.getProduto().getId()).distinct().toList();
        if (ids.isEmpty()) throw conflito("A venda deve possuir itens para faturamento.");
        return faturar(venda, pedido, autenticado, operador, resumo, bloquearProdutos(autenticado.empresaId(), ids));
    }

    private Map<Long, ProdutoEntity> bloquearProdutos(Long empresaId, List<Long> ids) {
        Map<Long, ProdutoEntity> resultado = vendas.bloquearProdutos(empresaId, ids).stream()
                .collect(Collectors.toMap(ProdutoEntity::getId, Function.identity()));
        if (resultado.size() != ids.size()) throw conflito("Produto indisponível para esta empresa.");
        // Itens podem ter carregado o Produto antes do lock; reler o saldo agora evita usar esse snapshot.
        resultado.values().forEach(entityManager::refresh);
        return resultado;
    }

    private VendaResponseDTO faturar(VendaEntity venda, FaturamentoVendaDTO pedido,
                                     UsuarioAutenticado autenticado, UsuarioEntity operador, String resumo,
                                     Map<Long, ProdutoEntity> produtosMap) {
        if (venda.getStatus() != StatusVenda.ABERTA) throw conflito("Apenas vendas ABERTA podem ser faturadas.");
        if (venda.getItens().isEmpty()) throw conflito("A venda deve possuir itens para faturamento.");
        if (venda.getCliente() != null) {
            clientes.findByIdAndEmpresaId(venda.getCliente().getId(), autenticado.empresaId())
                    .filter(c -> Boolean.TRUE.equals(c.getAtivo()))
                    .orElseThrow(() -> conflito("Cliente indisponível para esta empresa."));
        }
        BigDecimal subtotal = BigDecimal.ZERO;
        for (var item : venda.getItens()) {
            ProdutoEntity produto = produtosMap.get(item.getProduto().getId());
            if (produto == null || !Boolean.TRUE.equals(produto.getAtivo())) throw conflito("Produto indisponível.");
            validarQuantidade(item.getQuantidade());
            if (item.getPrecoUnitario() == null || item.getPrecoUnitario().signum() < 0) throw conflito("Preço inválido.");
            BigDecimal valor = item.getQuantidade().multiply(item.getPrecoUnitario()).setScale(2, RoundingMode.HALF_UP);
            if (valor.compareTo(item.getSubtotal()) != 0) throw conflito("Subtotal do item inconsistente.");
            subtotal = subtotal.add(valor);
        }
        BigDecimal desconto = venda.getDesconto();
        if (desconto == null || desconto.signum() < 0 || desconto.compareTo(subtotal) >= 0) {
            throw conflito("O desconto deve ser menor que o subtotal da venda.");
        }
        BigDecimal total = subtotal.subtract(desconto).setScale(2, RoundingMode.HALF_UP);
        if (subtotal.compareTo(venda.getSubtotal()) != 0 || total.compareTo(venda.getTotal()) != 0
                || total.compareTo(pedido.totalEsperado()) != 0) throw conflito("O total mudou. Revise os itens antes de finalizar.");
        var parcelas = prepararPagamentos(pedido, autenticado.empresaId(), total);
        contasReceber.validarParcelasVenda(venda, pedido.parcelasPrazo());
        BigDecimal recebido = parcelas.stream().map(p -> p.recebido() == null ? p.valor() : p.recebido())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        venda.vincularSessaoCaixa(caixaOperacional.resolverSessao(pedido.sessaoCaixaId(), autenticado.empresaId(), autenticado.usuarioId()));
        for (var item : venda.getItens()) {
            if (Boolean.TRUE.equals(produtosMap.get(item.getProduto().getId()).getControlaEstoque())) {
                var movimento = estoque.movimentar(autenticado.empresaId(), item.getProduto().getId(),
                        autenticado.usuarioId(), TipoMovimentacaoEstoque.SAIDA, OrigemMovimentacaoEstoque.VENDA,
                        item.getQuantidade(), "Venda " + venda.getId());
                item.setMovimentacaoEstoqueId(movimento.getId());
            }
        }
        // Campos singulares permanecem compativeis; em venda mista os detalhes pertencem aos Pagamentos.
        var unico = parcelas.size() == 1 && pedido.parcelasPrazo() == null ? parcelas.getFirst() : null;
        venda.vincularConfiguracaoFormaPagamento(unico == null ? null : unico.configuracao());
        venda.registrarFaturamento(pedido.chaveRequisicao(), resumo,
                unico == null ? null : unico.forma().getTipo().contratoVenda(), recebido,
                recebido.subtract(parcelas.stream().map(PagamentoPreparado::valor).reduce(BigDecimal.ZERO, BigDecimal::add)),
                total.subtract(parcelas.stream().map(PagamentoPreparado::valor).reduce(BigDecimal.ZERO, BigDecimal::add)));
        for (int i = 0; i < parcelas.size(); i++) {
            var parcela = parcelas.get(i);
            var pagamento = pagamentos.registrarFaturamento(venda, operador, parcela.forma(), parcela.configuracao(),
                    i + 1, parcela.valor(), parcela.recebido());
            recebiveis.gerar(pagamento);
            caixaOperacional.registrarVenda(pagamento);
        }
        contasReceber.gerarDaVenda(venda, pedido.parcelasPrazo());
        return VendaResponseDTO.de(venda);
    }

    private record PagamentoPreparado(FormaPagamentoEntity forma, ConfiguracaoFormaPagamentoEmpresaEntity configuracao,
            BigDecimal valor, BigDecimal recebido) { }

    private List<PagamentoPreparado> prepararPagamentos(FaturamentoVendaDTO pedido, Long empresaId, BigDecimal total) {
        if (!pedido.isFormaInformadaCorretamente())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe pagamentos ou uma forma unica, sem misturar os formatos.");
        List<PagamentoPreparado> parcelas = new ArrayList<>();
        if (pedido.pagamentos() == null && pedido.parcelasPrazo() == null) {
            var forma = pagamentos.resolverForma(pedido.formaPagamento(), pedido.formaPagamentoId());
            var config = pagamentos.resolverConfiguracao(pedido.configuracaoFormaPagamentoId(), empresaId, forma);
            parcelas.add(prepararParcela(forma, config, total, pedido.valorRecebido()));
        } else if (pedido.pagamentos() != null) {
            if ((pedido.pagamentos().isEmpty() && pedido.parcelasPrazo() == null) || pedido.pagamentos().size() > 20)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe de 1 a 20 pagamentos.");
            var ids = pedido.pagamentos().stream().map(p -> p == null ? null : p.configuracaoFormaPagamentoId()).toList();
            if (ids.stream().anyMatch(id -> id == null || id <= 0))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe uma configuracao valida para cada pagamento.");
            if (new HashSet<>(ids).size() != ids.size()) throw conflito("Agrupe os valores da mesma configuracao de pagamento.");
            // Preserva locks existentes de configuracao em ordem deterministica, sem alterar a sequencia do payload.
            Map<Long, ConfiguracaoFormaPagamentoEmpresaEntity> configs = new HashMap<>();
            ids.stream().sorted().forEach(id -> configs.put(id, pagamentos.resolverConfiguracao(id, empresaId, null)));
            for (var input : pedido.pagamentos()) {
                var config = configs.get(input.configuracaoFormaPagamentoId());
                var forma = pagamentos.resolverForma(null, config.getFormaPagamento().getId());
                parcelas.add(prepararParcela(forma, config, input.valor(), input.valorRecebido()));
            }
        }
        BigDecimal soma = parcelas.stream().map(PagamentoPreparado::valor).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (pedido.parcelasPrazo() != null) {
            for (var p : pedido.parcelasPrazo()) {
                if (p == null || p.valor() == null || p.valor().signum() <= 0 || p.valor().scale() > 2 || p.vencimento() == null)
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe valor positivo e vencimento para cada parcela a prazo.");
                soma = soma.add(p.valor());
            }
        }
        if (soma.compareTo(total) != 0) throw conflito("A soma dos pagamentos e parcelas a prazo deve corresponder ao total da venda.");
        return parcelas;
    }

    private PagamentoPreparado prepararParcela(FormaPagamentoEntity forma, ConfiguracaoFormaPagamentoEmpresaEntity config,
            BigDecimal valor, BigDecimal recebido) {
        if (valor == null || valor.signum() <= 0 || valor.stripTrailingZeros().scale() > 2
                || valor.precision() - valor.scale() > 12
                || (recebido != null && (recebido.signum() < 0 || recebido.stripTrailingZeros().scale() > 2
                    || recebido.precision() - recebido.scale() > 12)))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe valores positivos com ate duas casas decimais.");
        valor = valor.setScale(2, RoundingMode.UNNECESSARY);
        if (forma.getTipo() == TipoFormaPagamento.DINHEIRO) {
            if (recebido == null) recebido = valor;
            if (recebido.compareTo(valor) < 0) throw conflito("O valor recebido e menor que a parcela em dinheiro.");
        } else {
            if (recebido != null && recebido.compareTo(valor) != 0)
                throw conflito("PIX e cartao devem corresponder ao valor da parcela, sem troco.");
            recebido = null;
        }
        return new PagamentoPreparado(forma, config, valor, recebido);
    }

    private void validarQuantidade(BigDecimal quantidade) {
        if (quantidade == null || quantidade.signum() <= 0
                || quantidade.stripTrailingZeros().scale() > 3 || quantidade.compareTo(new BigDecimal("1000000000")) >= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Quantidade deve ser positiva, com até três casas decimais.");
        }
    }

    private void recalcularTotais(VendaEntity venda) {
        BigDecimal subtotal = calcularSubtotal(venda);
        BigDecimal desconto = venda.getDesconto() != null ? venda.getDesconto() : BigDecimal.ZERO;
        BigDecimal total = subtotal.subtract(desconto).setScale(2, RoundingMode.HALF_UP);
        if (total.signum() < 0) throw conflito("Revise o desconto antes de reduzir os itens.");
        venda.setSubtotal(subtotal);
        venda.setTotal(total);
        vendas.save(venda);
    }

    private BigDecimal calcularSubtotal(VendaEntity venda) {
        List<ItemVendaEntity> itens = venda.getItens();
        BigDecimal sum = BigDecimal.ZERO;
        for (ItemVendaEntity item : itens) {
            sum = sum.add(item.getSubtotal());
        }
        return sum.setScale(2, RoundingMode.HALF_UP);
    }

    private VendaEntity buscarVendaAberta(Long vendaId, Long empresaId) {
        VendaEntity venda = vendas.findByIdAndEmpresaIdWithLock(vendaId, empresaId)
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

    private String resumo(Object pedido) {
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
