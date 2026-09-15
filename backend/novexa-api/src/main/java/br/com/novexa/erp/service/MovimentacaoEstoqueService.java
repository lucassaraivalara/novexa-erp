package br.com.novexa.erp.service;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.exception.*;
import br.com.novexa.erp.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

@Service
public class MovimentacaoEstoqueService {

    private static final BigDecimal ZERO = BigDecimal.ZERO;

    private final MovimentacaoEstoqueRepository movimentacaoRepository;
    private final ProdutoRepository produtoRepository;
    private final UsuarioRepository usuarioRepository;
    private final EmpresaRepository empresaRepository;

    public MovimentacaoEstoqueService(
            MovimentacaoEstoqueRepository movimentacaoRepository,
            ProdutoRepository produtoRepository,
            UsuarioRepository usuarioRepository,
            EmpresaRepository empresaRepository) {
        this.movimentacaoRepository = movimentacaoRepository;
        this.produtoRepository = produtoRepository;
        this.usuarioRepository = usuarioRepository;
        this.empresaRepository = empresaRepository;
    }

    @Transactional
    public MovimentacaoEstoqueEntity movimentar(
            Long empresaId,
            Long produtoId,
            Long usuarioId,
            TipoMovimentacaoEstoque tipo,
            OrigemMovimentacaoEstoque origem,
            BigDecimal quantidade,
            String motivo) {

        validarParametrosObrigatorios(empresaId, produtoId, usuarioId, tipo, origem, quantidade);

        EmpresaEntity empresa = buscarEmpresa(empresaId);
        ProdutoEntity produto = buscarProdutoComLock(produtoId, empresaId);
        UsuarioEntity usuario = buscarUsuario(usuarioId, empresaId);

        validarProdutoControlaEstoque(produto);
        validarEmpresaUsuario(produto, usuario, empresa);

        return aplicarMovimentacao(empresa, produto, usuario, tipo, origem, quantidade, motivo);
    }

    // Exclusivo do núcleo de cancelamento, sob lock da Venda e na transação do chamador.
    // Reverte uma baixa histórica mesmo se o cadastro deixou de controlar estoque.
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    MovimentacaoEstoqueEntity reverterSaidaVenda(MovimentacaoEstoqueEntity original,
            Long usuarioId, String motivo) {
        if (original.getTipo() != TipoMovimentacaoEstoque.SAIDA
                || original.getOrigem() != OrigemMovimentacaoEstoque.VENDA)
            throw new IllegalArgumentException("Somente uma saída de venda pode ser revertida.");
        Long empresaId = original.getEmpresa().getId();
        ProdutoEntity produto = buscarProdutoComLock(original.getProduto().getId(), empresaId);
        UsuarioEntity usuario = buscarUsuario(usuarioId, empresaId);
        validarEmpresaUsuario(produto, usuario, original.getEmpresa());
        return aplicarMovimentacao(original.getEmpresa(), produto, usuario, TipoMovimentacaoEstoque.ENTRADA,
                OrigemMovimentacaoEstoque.CANCELAMENTO, original.getQuantidade(), motivo);
    }

    private MovimentacaoEstoqueEntity aplicarMovimentacao(EmpresaEntity empresa, ProdutoEntity produto,
            UsuarioEntity usuario, TipoMovimentacaoEstoque tipo, OrigemMovimentacaoEstoque origem,
            BigDecimal quantidade, String motivo) {
        BigDecimal saldoAnterior = produto.getEstoqueAtual();
        BigDecimal saldoPosterior = calcularSaldoPosterior(tipo, saldoAnterior, quantidade);

        validarSaldoNaoNegativo(tipo, saldoPosterior, saldoAnterior, quantidade);

        produto.setEstoqueAtual(saldoPosterior);
        produtoRepository.save(produto);

        MovimentacaoEstoqueEntity movimentacao = criarMovimentacao(
                empresa, produto, usuario, tipo, origem, quantidade,
                saldoAnterior, saldoPosterior, motivo
        );

        return movimentacaoRepository.save(movimentacao);
    }

    private void validarParametrosObrigatorios(
            Long empresaId, Long produtoId, Long usuarioId,
            TipoMovimentacaoEstoque tipo, OrigemMovimentacaoEstoque origem,
            BigDecimal quantidade) {

        if (empresaId == null) throw new IllegalArgumentException("Empresa é obrigatória.");
        if (produtoId == null) throw new IllegalArgumentException("Produto é obrigatório.");
        if (usuarioId == null) throw new IllegalArgumentException("Usuário é obrigatório.");
        if (tipo == null) throw new IllegalArgumentException("Tipo de movimentação é obrigatório.");
        if (origem == null) throw new IllegalArgumentException("Origem da movimentação é obrigatória.");
        if (quantidade == null) throw new IllegalArgumentException("Quantidade é obrigatória.");
        if (quantidade.compareTo(ZERO) <= 0 && tipo != TipoMovimentacaoEstoque.AJUSTE) {
            throw new IllegalArgumentException("Quantidade deve ser maior que zero.");
        }
        if (tipo == TipoMovimentacaoEstoque.AJUSTE && quantidade.compareTo(ZERO) < 0) {
            throw new IllegalArgumentException("Saldo ajustado não pode ser negativo.");
        }
    }

    private EmpresaEntity buscarEmpresa(Long empresaId) {
        return empresaRepository.findById(empresaId)
                .orElseThrow(() -> new EmpresaNotFoundException("Empresa não encontrada."));
    }

    private ProdutoEntity buscarProdutoComLock(Long produtoId, Long empresaId) {
        return produtoRepository.findByIdAndEmpresaIdWithLock(produtoId, empresaId)
                .orElseThrow(() -> new ProdutoNotFoundException(
                        "Produto não encontrado para a empresa informada."
                ));
    }

    private UsuarioEntity buscarUsuario(Long usuarioId, Long empresaId) {
        return usuarioRepository.findByIdAndEmpresaId(usuarioId, empresaId)
                .orElseThrow(() -> new UsuarioNotFoundException("Usuário não encontrado."));
    }

    private void validarProdutoControlaEstoque(ProdutoEntity produto) {
        if (Boolean.FALSE.equals(produto.getControlaEstoque())) {
            throw new ProdutoNaoControlaEstoqueException(
                    "Produto não controla estoque. Movimentação não permitida."
            );
        }
    }

    private void validarEmpresaUsuario(ProdutoEntity produto, UsuarioEntity usuario, EmpresaEntity empresa) {
        if (!Objects.equals(produto.getEmpresa().getId(), empresa.getId())) {
            throw new IllegalArgumentException("Produto não pertence à empresa informada.");
        }
        if (!Objects.equals(usuario.getEmpresa().getId(), empresa.getId())) {
            throw new IllegalArgumentException("Usuário não pertence à empresa informada.");
        }
    }

    private BigDecimal calcularSaldoPosterior(
            TipoMovimentacaoEstoque tipo,
            BigDecimal saldoAnterior,
            BigDecimal quantidade) {

        return switch (tipo) {
            case ENTRADA -> saldoAnterior.add(quantidade);
            case SAIDA -> saldoAnterior.subtract(quantidade);
            case AJUSTE -> quantidade;
        };
    }

    private void validarSaldoNaoNegativo(
            TipoMovimentacaoEstoque tipo,
            BigDecimal saldoPosterior,
            BigDecimal saldoAnterior,
            BigDecimal quantidade) {

        if (tipo == TipoMovimentacaoEstoque.SAIDA && saldoPosterior.compareTo(ZERO) < 0) {
            throw new EstoqueInsuficienteException(
                    String.format("Saldo insuficiente. Estoque atual: %s, quantidade solicitada: %s",
                            saldoAnterior, quantidade)
            );
        }
    }

    private MovimentacaoEstoqueEntity criarMovimentacao(
            EmpresaEntity empresa,
            ProdutoEntity produto,
            UsuarioEntity usuario,
            TipoMovimentacaoEstoque tipo,
            OrigemMovimentacaoEstoque origem,
            BigDecimal quantidade,
            BigDecimal saldoAnterior,
            BigDecimal saldoPosterior,
            String motivo) {

        MovimentacaoEstoqueEntity mov = new MovimentacaoEstoqueEntity();
        mov.setEmpresa(empresa);
        mov.setProduto(produto);
        mov.setUsuario(usuario);
        mov.setTipo(tipo);
        mov.setOrigem(origem);
        mov.setQuantidade(quantidade);
        mov.setSaldoAnterior(saldoAnterior);
        mov.setSaldoPosterior(saldoPosterior);
        mov.setMotivo(motivo);
        return mov;
    }

    public List<MovimentacaoEstoqueEntity> buscarPorProduto(Long empresaId, Long produtoId) {
        return movimentacaoRepository.findByEmpresaIdAndProdutoIdOrderByDataHoraDesc(empresaId, produtoId);
    }
}