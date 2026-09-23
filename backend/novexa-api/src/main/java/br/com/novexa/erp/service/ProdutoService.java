package br.com.novexa.erp.service;

import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.entity.ProdutoEntity;
import br.com.novexa.erp.exception.ProdutoCodigoDuplicadoException;
import br.com.novexa.erp.exception.ProdutoInvalidoException;
import br.com.novexa.erp.exception.ProdutoNotFoundException;
import br.com.novexa.erp.repository.ProdutoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import br.com.novexa.erp.storage.ArquivoStorageService;
import br.com.novexa.erp.security.UsuarioAutenticado;
import org.springframework.web.multipart.MultipartFile;


import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;

@Service
public class ProdutoService {

    private static final BigDecimal ZERO = BigDecimal.ZERO;
    private static final long TAMANHO_MAXIMO_IMAGEM = 2L * 1024 * 1024;

    private final ProdutoRepository produtoRepository;
    private final EmpresaService empresaService;
    private final ArquivoStorageService arquivoStorageService;

    public ProdutoService(
            ProdutoRepository produtoRepository,
            EmpresaService empresaService,
            ArquivoStorageService arquivoStorageService
    ) {
        this.produtoRepository = produtoRepository;
        this.empresaService = empresaService;
        this.arquivoStorageService = arquivoStorageService;
    }

    public ProdutoEntity salvar(ProdutoEntity produto, Long empresaId) {
        produto.setEmpresa(buscarEmpresa(empresaId));
        prepararDados(produto, null);
        validarCodigosDuplicados(produto, empresaId, null);

        return produtoRepository.save(produto);
    }

    public List<ProdutoEntity> listar(Long empresaId) {
        buscarEmpresa(empresaId);
        return produtoRepository.findAllByEmpresaIdOrderByNomeAsc(empresaId);
    }

    public ProdutoEntity buscarPorId(Long id, Long empresaId) {
        buscarEmpresa(empresaId);

        return produtoRepository.findByIdAndEmpresaId(id, empresaId)
                .orElseThrow(() -> new ProdutoNotFoundException(
                        "Produto não encontrado para a empresa informada."
                ));
    }

    public List<ProdutoEntity> buscarPorTermo(Long empresaId, String termo) {
        buscarEmpresa(empresaId);

        if (termo == null || termo.isBlank()) {
            return produtoRepository.findAllByEmpresaIdOrderByNomeAsc(empresaId);
        }

        return produtoRepository.buscarPorTermo(empresaId, termo.trim());
    }
    public ProdutoEntity salvarImagem(
            Long produtoId,
            MultipartFile arquivo,
            UsuarioAutenticado usuarioAutenticado
    ) {
        validarImagem(arquivo);
        ProdutoEntity produto = produtoRepository
                .findByIdAndEmpresaId(produtoId, usuarioAutenticado.empresaId())
                .orElseThrow(() -> new ProdutoNotFoundException(
                        "Produto não encontrado para a empresa informada."
                ));

        String caminhoAntigo = produto.getImagemPath();

        String novoCaminho = arquivoStorageService.salvarImagemProduto(
                usuarioAutenticado.empresaId(),
                produto.getId(),
                arquivo
        );

        produto.setImagemPath(novoCaminho);

        ProdutoEntity produtoSalvo = produtoRepository.save(produto);

        if (caminhoAntigo != null && !caminhoAntigo.isBlank()) {
            arquivoStorageService.removerImagem(caminhoAntigo);
        }

        return produtoSalvo;
    }

    @Transactional
    public ProdutoEntity removerImagem(Long produtoId, UsuarioAutenticado usuarioAutenticado) {
        ProdutoEntity produto = produtoRepository
                .findByIdAndEmpresaId(produtoId, usuarioAutenticado.empresaId())
                .orElseThrow(() -> new ProdutoNotFoundException("Produto não encontrado para a empresa informada."));

        String caminhoAntigo = produto.getImagemPath();
        produto.setImagemPath(null);
        ProdutoEntity produtoSalvo = produtoRepository.save(produto);

        if (caminhoAntigo != null && !caminhoAntigo.isBlank()) {
            arquivoStorageService.removerImagem(caminhoAntigo);
        }

        return produtoSalvo;
    }


    @Transactional
    public ProdutoEntity atualizar(
            Long id,
            ProdutoEntity dadosNovos,
            Long empresaId) {

        ProdutoEntity produtoExistente = buscarPorId(id, empresaId);
        prepararDados(dadosNovos, produtoExistente);
        validarCodigosDuplicados(dadosNovos, empresaId, id);

        produtoExistente.setCodigoInterno(dadosNovos.getCodigoInterno());
        produtoExistente.setCodigoBarras(dadosNovos.getCodigoBarras());
        produtoExistente.setNome(dadosNovos.getNome());
        produtoExistente.setDescricao(dadosNovos.getDescricao());
        produtoExistente.setUnidadeMedida(dadosNovos.getUnidadeMedida());
        produtoExistente.setPrecoCusto(dadosNovos.getPrecoCusto());
        produtoExistente.setPrecoVenda(dadosNovos.getPrecoVenda());
        produtoExistente.setEstoqueMinimo(dadosNovos.getEstoqueMinimo());
        produtoExistente.setControlaEstoque(dadosNovos.getControlaEstoque());
        produtoExistente.setAtivo(dadosNovos.getAtivo());

        return produtoRepository.save(produtoExistente);
    }

    @Transactional
    public void inativar(Long id, Long empresaId) {
        ProdutoEntity produto = buscarPorId(id, empresaId);
        produto.setAtivo(false);
        produtoRepository.save(produto);
    }

    private EmpresaEntity buscarEmpresa(Long empresaId) {
        return empresaService.buscarPorId(empresaId);
    }

    private void prepararDados(ProdutoEntity produto, ProdutoEntity produtoExistente) {
        produto.setCodigoInterno(normalizarCodigoInterno(produto.getCodigoInterno()));
        produto.setCodigoBarras(normalizarCodigoBarras(produto.getCodigoBarras()));
        produto.setNome(validarTextoObrigatorio(produto.getNome(), "O nome do produto é obrigatório."));
        produto.setUnidadeMedida(validarTextoObrigatorio(
                produto.getUnidadeMedida(),
                "A unidade de medida é obrigatória."
        ).toUpperCase(Locale.ROOT));

        produto.setPrecoCusto(valorOuAnterior(
                produto.getPrecoCusto(),
                produtoExistente == null ? ZERO : produtoExistente.getPrecoCusto()
        ));
        produto.setPrecoVenda(valorObrigatorio(produto.getPrecoVenda(), "O preço de venda é obrigatório."));
        // estoqueAtual não deve ser alterado via cadastro/edição de produto.
        // Para novo produto, inicia com ZERO. Para edição, preserva o valor existente.
        if (produtoExistente != null) {
            produto.setEstoqueAtual(produtoExistente.getEstoqueAtual());
        } else {
            produto.setEstoqueAtual(ZERO);
        }
        produto.setEstoqueMinimo(valorOuAnterior(
                produto.getEstoqueMinimo(),
                produtoExistente == null ? ZERO : produtoExistente.getEstoqueMinimo()
        ));
        produto.setControlaEstoque(valorBooleanoOuAnterior(
                produto.getControlaEstoque(),
                produtoExistente == null || produtoExistente.getControlaEstoque()
        ));
        produto.setAtivo(valorBooleanoOuAnterior(
                produto.getAtivo(),
                produtoExistente == null || produtoExistente.getAtivo()
        ));

        validarValorNaoNegativo(produto.getPrecoCusto(), "O preço de custo não pode ser negativo.");
        validarValorNaoNegativo(produto.getPrecoVenda(), "O preço de venda não pode ser negativo.");
        validarValorNaoNegativo(produto.getEstoqueAtual(), "O estoque atual não pode ser negativo.");
        validarValorNaoNegativo(produto.getEstoqueMinimo(), "O estoque mínimo não pode ser negativo.");
    }

    private void validarCodigosDuplicados(
            ProdutoEntity produto,
            Long empresaId,
            Long produtoId) {

        if (produto.getCodigoInterno() != null) {
            boolean codigoInternoDuplicado = produtoId == null
                    ? produtoRepository.existsByEmpresaIdAndCodigoInterno(
                    empresaId,
                    produto.getCodigoInterno()
            )
                    : produtoRepository.existsByEmpresaIdAndCodigoInternoAndIdNot(
                    empresaId,
                    produto.getCodigoInterno(),
                    produtoId
            );

            if (codigoInternoDuplicado) {
                throw new ProdutoCodigoDuplicadoException(
                        "Já existe um produto com este código interno na empresa informada."
                );
            }
        }

        if (produto.getCodigoBarras() != null) {
            boolean codigoBarrasDuplicado = produtoId == null
                    ? produtoRepository.existsByEmpresaIdAndCodigoBarras(
                    empresaId,
                    produto.getCodigoBarras()
            )
                    : produtoRepository.existsByEmpresaIdAndCodigoBarrasAndIdNot(
                    empresaId,
                    produto.getCodigoBarras(),
                    produtoId
            );

            if (codigoBarrasDuplicado) {
                throw new ProdutoCodigoDuplicadoException(
                        "Já existe um produto com este código de barras na empresa informada."
                );
            }
        }
    }

    private String normalizarCodigoInterno(String codigoInterno) {
        if (codigoInterno == null || codigoInterno.isBlank()) {
            return null;
        }

        return codigoInterno.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizarCodigoBarras(String codigoBarras) {
        if (codigoBarras == null || codigoBarras.isBlank()) {
            return null;
        }

        return codigoBarras.replaceAll("\\s", "");
    }

    private String validarTextoObrigatorio(String valor, String mensagem) {
        if (valor == null || valor.isBlank()) {
            throw new ProdutoInvalidoException(mensagem);
        }

        return valor.trim();
    }

    private BigDecimal valorObrigatorio(BigDecimal valor, String mensagem) {
        if (valor == null) {
            throw new ProdutoInvalidoException(mensagem);
        }

        return valor;
    }

    private BigDecimal valorOuAnterior(BigDecimal valor, BigDecimal valorPadrao) {
        return valor == null ? valorPadrao : valor;
    }

    private Boolean valorBooleanoOuAnterior(Boolean valor, Boolean valorPadrao) {
        return valor == null ? valorPadrao : valor;
    }

    private void validarValorNaoNegativo(BigDecimal valor, String mensagem) {
        if (valor.compareTo(ZERO) < 0) {
            throw new ProdutoInvalidoException(mensagem);
        }
    }

    private void validarImagem(MultipartFile arquivo) {
        if (arquivo == null || arquivo.isEmpty()) {
            throw new ProdutoInvalidoException("Selecione uma imagem.");
        }
        if (arquivo.getSize() > TAMANHO_MAXIMO_IMAGEM) {
            throw new ProdutoInvalidoException("A imagem deve ter no máximo 2 MB.");
        }
        if (arquivo.getContentType() == null || !arquivo.getContentType().startsWith("image/")) {
            throw new ProdutoInvalidoException("O arquivo deve ser uma imagem.");
        }
    }
}
