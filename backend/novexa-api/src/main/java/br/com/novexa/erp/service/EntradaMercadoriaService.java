package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.util.Paginacao;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Sort;
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
import java.util.*;

@Service
@Transactional
public class EntradaMercadoriaService {
    private final EntradaMercadoriaRepository entradas;
    private final FornecedorRepository fornecedores;
    private final ProdutoRepository produtos;
    private final MovimentacaoEstoqueRepository movimentos;
    private final MovimentacaoEstoqueService estoque;
    private final EntityManager em;

    public EntradaMercadoriaService(EntradaMercadoriaRepository entradas, FornecedorRepository fornecedores,
            ProdutoRepository produtos, MovimentacaoEstoqueRepository movimentos, MovimentacaoEstoqueService estoque,
            EntityManager em) {
        this.entradas = entradas; this.fornecedores = fornecedores; this.produtos = produtos;
        this.movimentos = movimentos; this.estoque = estoque; this.em = em;
    }

    public EntradaMercadoriaResponseDTO criar(EntradaMercadoriaRequestDTO pedido, UsuarioAutenticado usuario) {
        var operador = entradas.bloquearOperador(usuario.usuarioId(), usuario.empresaId())
                .filter(u -> Boolean.TRUE.equals(u.getAtivo()) && Boolean.TRUE.equals(u.getEmpresa().getAtivo()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Usuario indisponivel."));
        String resumo = pedido.chaveRequisicao() == null ? null : resumo(pedido);
        if (pedido.chaveRequisicao() != null) {
            var anterior = entradas.findByEmpresaIdAndUsuarioCadastroIdAndChaveRequisicao(
                    usuario.empresaId(), usuario.usuarioId(), pedido.chaveRequisicao());
            if (anterior.isPresent()) {
                if (!Objects.equals(anterior.get().getResumoRequisicao(), resumo))
                    throw conflito("Chave de requisicao ja utilizada com outros dados.");
                return detalhe(anterior.get());
            }
        }
        var entrada = new EntradaMercadoriaEntity();
        entrada.setEmpresa(operador.getEmpresa()); entrada.setUsuarioCadastroId(usuario.usuarioId());
        entrada.setChaveRequisicao(pedido.chaveRequisicao()); entrada.setResumoRequisicao(resumo);
        preencher(entrada, pedido, usuario.empresaId());
        return detalhe(entradas.saveAndFlush(entrada));
    }

    public EntradaMercadoriaResponseDTO editar(Long id, EntradaMercadoriaRequestDTO pedido, UsuarioAutenticado usuario) {
        var entrada = bloquear(id, usuario.empresaId());
        if (entrada.getStatus() != StatusEntradaMercadoria.RASCUNHO) throw conflito("Somente rascunhos podem ser editados.");
        // Remove os itens antigos antes das insercoes, preservando a unicidade produto/ordem.
        entrada.getItens().clear(); em.flush();
        preencher(entrada, pedido, usuario.empresaId());
        entrada.registrarEdicao();
        return detalhe(entradas.saveAndFlush(entrada));
    }

    public EntradaMercadoriaResponseDTO confirmar(Long id, UsuarioAutenticado usuario) {
        var entrada = bloquear(id, usuario.empresaId());
        if (entrada.getStatus() == StatusEntradaMercadoria.CONFIRMADA) return detalhe(entrada);
        if (entrada.getStatus() != StatusEntradaMercadoria.RASCUNHO) throw conflito("Entrada cancelada nao pode ser confirmada.");
        var fornecedor = fornecedor(entrada.getFornecedor().getId(), usuario.empresaId());
        em.refresh(fornecedor, LockModeType.PESSIMISTIC_READ);
        if (!Boolean.TRUE.equals(fornecedor.getAtivo())) throw conflito("Fornecedor inativo.");
        var bloqueados = bloquearProdutos(entrada, usuario.empresaId());
        for (var item : entrada.getItens()) {
            validarProduto(bloqueados.get(item.getProduto().getId()));
            if (item.getMovimentacaoEstoqueId() != null) throw conflito("Rascunho com movimentacao inconsistente.");
            var movimento = estoque.movimentar(usuario.empresaId(), item.getProduto().getId(), usuario.usuarioId(),
                    TipoMovimentacaoEstoque.ENTRADA, OrigemMovimentacaoEstoque.COMPRA, item.getQuantidade(),
                    "Entrada de mercadoria " + entrada.getId());
            item.setMovimentacaoEstoqueId(movimento.getId());
            bloqueados.get(item.getProduto().getId()).setPrecoCusto(item.getValorUnitario());
        }
        entrada.confirmar(usuario.usuarioId());
        return detalhe(entradas.saveAndFlush(entrada));
    }

    public EntradaMercadoriaResponseDTO cancelar(Long id, UsuarioAutenticado usuario) {
        var entrada = bloquear(id, usuario.empresaId());
        if (entrada.getStatus() == StatusEntradaMercadoria.CANCELADA) return detalhe(entrada);
        if (entrada.getStatus() != StatusEntradaMercadoria.CONFIRMADA) throw conflito("Somente entradas confirmadas podem ser canceladas.");
        bloquearProdutos(entrada, usuario.empresaId());
        for (var item : entrada.getItens()) {
            if (item.getMovimentacaoEstoqueId() == null || item.getMovimentacaoCancelamentoId() != null)
                throw conflito("Movimentacao original inconsistente.");
            var original = movimentos.findByIdAndEmpresaId(item.getMovimentacaoEstoqueId(), usuario.empresaId())
                    .orElseThrow(() -> conflito("Movimentacao original nao encontrada."));
            if (!Objects.equals(original.getProduto().getId(), item.getProduto().getId())
                    || original.getTipo() != TipoMovimentacaoEstoque.ENTRADA
                    || original.getOrigem() != OrigemMovimentacaoEstoque.COMPRA
                    || original.getQuantidade().compareTo(item.getQuantidade()) != 0)
                throw conflito("Movimentacao original inconsistente.");
            var reversao = estoque.reverterEntradaCompra(original, usuario.usuarioId(), "Cancelamento da entrada " + id);
            item.setMovimentacaoCancelamentoId(reversao.getId());
        }
        entrada.cancelar(usuario.usuarioId());
        return detalhe(entradas.saveAndFlush(entrada));
    }

    @Transactional(readOnly = true)
    public EntradaMercadoriaResponseDTO buscar(Long id, Long empresaId) {
        return detalhe(entradas.findByIdAndEmpresaId(id, empresaId).orElseThrow(() -> naoEncontrada("Entrada")));
    }

    @Transactional(readOnly = true)
    public PaginaResponseDTO<EntradaMercadoriaResponseDTO> listar(Long empresaId, String termo,
            StatusEntradaMercadoria status, OrigemEntradaMercadoria origem, Long fornecedorId,
            LocalDate inicio, LocalDate fim, int page, int size, String sort) {
        var pageable = Paginacao.criar(page, size, sort, Set.of("id", "dataEntrada", "dataEmissao", "numeroNota",
                "status", "origem", "valorTotal", "dataCadastro"), Sort.Direction.DESC);
        if (inicio != null && fim != null && inicio.isAfter(fim)) throw Paginacao.invalida("Periodo invalido.");
        String busca = termo == null ? "" : termo.trim();
        String padrao = "%" + busca.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
        return PaginaResponseDTO.de(entradas.listarPagina(empresaId, padrao, status, origem, fornecedorId, inicio, fim, pageable),
                e -> EntradaMercadoriaResponseDTO.de(e, false));
    }

    private void preencher(EntradaMercadoriaEntity entrada, EntradaMercadoriaRequestDTO p, Long empresaId) {
        entrada.setFornecedor(fornecedor(p.fornecedorId(), empresaId));
        entrada.setNumeroNota(limpar(p.numeroNota())); entrada.setSerie(limpar(p.serie()));
        entrada.setChaveAcessoNfe(limpar(p.chaveAcessoNfe())); entrada.setDataEmissao(p.dataEmissao());
        entrada.setDataEntrada(p.dataEntrada() == null ? LocalDate.now() : p.dataEntrada());
        entrada.setObservacao(limpar(p.observacao()));
        Set<Long> ids = new HashSet<>(); BigDecimal total = BigDecimal.ZERO.setScale(2);
        for (var dados : p.itens()) {
            if (!ids.add(dados.produtoId())) throw conflito("Agrupe as quantidades do mesmo produto.");
            var produto = produtos.findByIdAndEmpresaId(dados.produtoId(), empresaId).orElseThrow(() -> naoEncontrada("Produto"));
            validarProduto(produto);
            var item = new ItemEntradaMercadoriaEntity(); item.setEmpresa(entrada.getEmpresa()); item.setEntrada(entrada);
            item.setProduto(produto); item.setOrdem(entrada.getItens().size());
            item.setQuantidade(dados.quantidade().setScale(3, RoundingMode.UNNECESSARY));
            item.setValorUnitario(dados.valorUnitario().setScale(2, RoundingMode.UNNECESSARY));
            item.setValorTotal(item.getQuantidade().multiply(item.getValorUnitario()).setScale(2, RoundingMode.HALF_UP));
            item.setDescricaoOriginal(limpar(dados.descricaoOriginal())); item.setCodigoProdutoFornecedor(limpar(dados.codigoProdutoFornecedor()));
            item.setGtin(limpar(dados.gtin())); item.setNcm(limpar(dados.ncm())); item.setCfop(limpar(dados.cfop())); item.setUnidade(limpar(dados.unidade()));
            entrada.getItens().add(item); total = total.add(item.getValorTotal());
        }
        if (total.precision() > 19) throw Paginacao.invalida("Valor total excede o limite permitido.");
        entrada.setValorProdutos(total); entrada.setValorTotal(total);
    }

    private Map<Long, ProdutoEntity> bloquearProdutos(EntradaMercadoriaEntity entrada, Long empresaId) {
        if (entrada.getItens().isEmpty()) throw conflito("Entrada deve possuir itens.");
        Map<Long, ProdutoEntity> resultado = new TreeMap<>();
        for (Long id : entrada.getItens().stream().map(i -> i.getProduto().getId()).distinct().sorted().toList()) {
            var produto = produtos.findByIdAndEmpresaIdWithLock(id, empresaId).orElseThrow(() -> naoEncontrada("Produto"));
            // As relacoes dos itens podem ter carregado saldo/cadastro antes da espera pelo lock.
            em.refresh(produto); resultado.put(id, produto);
        }
        return resultado;
    }

    private FornecedorEntity fornecedor(Long id, Long empresaId) {
        var f = fornecedores.findByIdAndEmpresaId(id, empresaId).orElseThrow(() -> naoEncontrada("Fornecedor"));
        if (!Boolean.TRUE.equals(f.getAtivo())) throw conflito("Fornecedor inativo.");
        return f;
    }
    private void validarProduto(ProdutoEntity p) {
        if (!Boolean.TRUE.equals(p.getAtivo())) throw conflito("Produto inativo.");
        if (!Boolean.TRUE.equals(p.getControlaEstoque())) throw conflito("Produto nao controla estoque.");
    }
    private EntradaMercadoriaEntity bloquear(Long id, Long empresaId) {
        return entradas.bloquear(id, empresaId).orElseThrow(() -> naoEncontrada("Entrada"));
    }
    private EntradaMercadoriaResponseDTO detalhe(EntradaMercadoriaEntity e) { return EntradaMercadoriaResponseDTO.de(e, true); }
    private static String limpar(String v) { return v == null || v.isBlank() ? null : v.trim(); }
    private static ResponseStatusException conflito(String mensagem) { return new ResponseStatusException(HttpStatus.CONFLICT, mensagem); }
    private static ResponseStatusException naoEncontrada(String nome) { return new ResponseStatusException(HttpStatus.NOT_FOUND, nome + " nao encontrado(a)."); }
    private static String resumo(EntradaMercadoriaRequestDTO pedido) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(pedido.toString().getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
