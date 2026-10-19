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
    @org.springframework.beans.factory.annotation.Autowired private ComposicaoProdutoService composicoes;

    private static final BigDecimal ZERO = BigDecimal.ZERO;
    private static final long TAMANHO_MAXIMO_IMAGEM = 2L * 1024 * 1024;

    private final ProdutoRepository produtoRepository;
    private final EmpresaService empresaService;
    private final ArquivoStorageService arquivoStorageService;
    private final br.com.novexa.erp.repository.FornecedorRepository fornecedorRepository;

    private final br.com.novexa.erp.repository.CategoriaProdutoRepository categorias;
    private final br.com.novexa.erp.repository.SubcategoriaProdutoRepository subcategorias;
    private final br.com.novexa.erp.repository.MarcaRepository marcas;

    public ProdutoService(
            ProdutoRepository produtoRepository,
            EmpresaService empresaService,
            ArquivoStorageService arquivoStorageService,
            br.com.novexa.erp.repository.FornecedorRepository fornecedorRepository,
            br.com.novexa.erp.repository.CategoriaProdutoRepository categorias,
            br.com.novexa.erp.repository.SubcategoriaProdutoRepository subcategorias,
            br.com.novexa.erp.repository.MarcaRepository marcas
    ) {
        this.produtoRepository = produtoRepository;
        this.empresaService = empresaService;
        this.arquivoStorageService = arquivoStorageService;
        this.fornecedorRepository = fornecedorRepository;
        this.categorias = categorias; this.subcategorias = subcategorias; this.marcas = marcas;
    }

    @Transactional
    public ProdutoEntity salvar(ProdutoEntity produto, Long empresaId) {
        return salvar(produto, empresaId, null);
    }

    @Transactional
    public ProdutoEntity salvar(ProdutoEntity produto, Long empresaId, Long fornecedorId) {
        return salvar(produto, empresaId, fornecedorId, null);
    }

    @Transactional
    public ProdutoEntity salvar(ProdutoEntity produto, Long empresaId, Long fornecedorId, br.com.novexa.erp.dto.ProdutoRequestDTO classificacao) {
        produto.setEmpresa(buscarEmpresa(empresaId));
        aplicarClassificacao(produto, empresaId, classificacao);
        produto.setFornecedorPrincipal(buscarFornecedor(fornecedorId, empresaId));
        prepararDados(produto, null);
        validarCodigosDuplicados(produto, empresaId, null);

        var salvo=produtoRepository.save(produto);
        if (classificacao != null) composicoes.gravar(salvo, classificacao);
        return salvo;
    }

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<ProdutoEntity> listarPagina(Long empresaId, String busca,
            String campoBusca, String situacao, String situacaoEstoque, int page, int size, String sort) {
        return listarPagina(empresaId, busca, campoBusca, situacao, situacaoEstoque, page, size, sort, null, null, null);
    }

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<ProdutoEntity> listarPagina(Long empresaId, String busca,
            String campoBusca, String situacao, String situacaoEstoque, int page, int size, String sort,
            Long categoriaId, Long subcategoriaId, Long marcaId) {
        // A subcategoria isolada é um filtro válido, sem exigir seleção redundante da categoria.
        if (categoriaId != null) buscarCategoria(categoriaId, empresaId);
        if (marcaId != null) buscarMarca(marcaId, empresaId);
        if (subcategoriaId != null) {
            var sub = buscarSubcategoria(subcategoriaId, empresaId);
            if (categoriaId != null && !categoriaId.equals(sub.getCategoria().getId()))
                throw new ProdutoInvalidoException("A subcategoria não pertence à categoria selecionada.");
        }
        var pageable = br.com.novexa.erp.util.Paginacao.criar(page, size, sort,
                java.util.Set.of("id", "codigoInterno", "nome", "precoVenda", "estoqueAtual", "estoqueMinimo", "ativo"),
                org.springframework.data.domain.Sort.Direction.ASC);
        if (campoBusca != null && !java.util.Set.of("nome", "codigoInterno", "codigoBarras").contains(campoBusca))
            throw br.com.novexa.erp.util.Paginacao.invalida("Campo de busca invalido.");
        if (situacao != null && !java.util.Set.of("ativos", "inativos", "todos").contains(situacao))
            throw br.com.novexa.erp.util.Paginacao.invalida("Situacao invalida.");
        if (situacaoEstoque != null && !java.util.Set.of("baixo", "zerado", "normal", "semControle").contains(situacaoEstoque))
            throw br.com.novexa.erp.util.Paginacao.invalida("Situacao de estoque invalida.");
        if (pageable.getSort().stream().anyMatch(o -> o.getProperty().equals("estoqueAtual")))
            pageable=org.springframework.data.domain.PageRequest.of(pageable.getPageNumber(),pageable.getPageSize(),org.springframework.data.domain.Sort.by(pageable.getSort().stream().map(o -> new org.springframework.data.domain.Sort.Order(o.getDirection(),o.getProperty().equals("estoqueAtual")?"saldoDisponivel":o.getProperty())).toList()));
        Boolean ativo = "ativos".equals(situacao) ? Boolean.TRUE : "inativos".equals(situacao) ? Boolean.FALSE : null;
        return produtoRepository.listarPagina(empresaId, ativo,
                busca == null ? "" : busca.trim(), campoBusca, situacaoEstoque, categoriaId, subcategoriaId, marcaId, pageable);
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

    @Transactional(readOnly = true)
    public List<ProdutoEntity> buscarPorTermo(Long empresaId, String termo) {
        buscarEmpresa(empresaId);

        if (termo == null || termo.isBlank()) {
            return List.of();
        }

        return produtoRepository.buscarPorTermo(empresaId, termo.trim(),
                org.springframework.data.domain.PageRequest.of(0, 10));
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
        return atualizar(id, dadosNovos, empresaId, null, false);
    }

    @Transactional
    public ProdutoEntity atualizar(Long id, ProdutoEntity dadosNovos, Long empresaId,
                                  Long fornecedorId, boolean fornecedorInformado) {

        return atualizar(id, dadosNovos, empresaId, fornecedorId, fornecedorInformado, null);
    }

    @Transactional
    public ProdutoEntity atualizar(Long id, ProdutoEntity dadosNovos, Long empresaId,
                                  Long fornecedorId, boolean fornecedorInformado, br.com.novexa.erp.dto.ProdutoRequestDTO classificacao) {
        if (classificacao != null && classificacao.getComponentes() != null) composicoes.bloquearEdicao(id, empresaId, classificacao.getComponentes());
        else if (composicoes != null) composicoes.bloquearEdicao(id,empresaId,java.util.List.of());
        ProdutoEntity produtoExistente = buscarPorId(id, empresaId);
        if (classificacao != null && classificacao.getComposto() != null && classificacao.getComposto() != produtoExistente.isComposto())
            throw new ProdutoInvalidoException("O tipo simples/composto nao pode ser alterado; preserve o historico e cadastre outro produto.");
        aplicarClassificacao(produtoExistente, empresaId, classificacao);
        prepararDados(dadosNovos, produtoExistente);
        if (composicoes != null) composicoes.validarAlteracaoFisica(produtoExistente,dadosNovos);
        validarCodigosDuplicados(dadosNovos, empresaId, id);
        if (fornecedorInformado) produtoExistente.setFornecedorPrincipal(buscarFornecedor(fornecedorId, empresaId));

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

        if (classificacao != null) composicoes.gravar(produtoExistente, classificacao);
        return produtoRepository.save(produtoExistente);
    }

    @Transactional
    public void inativar(Long id, Long empresaId) {
        ProdutoEntity produto = buscarPorId(id, empresaId);
        produto.setAtivo(false);
        produtoRepository.save(produto);
    }

    private void aplicarClassificacao(ProdutoEntity produto, Long empresaId, br.com.novexa.erp.dto.ProdutoRequestDTO dados) {
        if (dados == null) return;
        if (dados.isNcmInformado()) produto.setNcm(dados.getNcm());
        if (dados.isCestInformado()) produto.setCest(dados.getCest());
        var categoria = dados.isCategoriaInformada() ? buscarCategoria(dados.getCategoriaId(), empresaId) : produto.getCategoria();
        var subcategoria = dados.isSubcategoriaInformada() ? buscarSubcategoria(dados.getSubcategoriaId(), empresaId) : produto.getSubcategoria();
        var marca = dados.isMarcaInformada() ? buscarMarca(dados.getMarcaId(), empresaId) : produto.getMarca();
        if (subcategoria != null && (categoria == null || !categoria.getId().equals(subcategoria.getCategoria().getId())))
            throw new ProdutoInvalidoException("A subcategoria deve pertencer à categoria selecionada. Remova ou selecione outra subcategoria.");
        produto.setCategoria(categoria); produto.setSubcategoria(subcategoria); produto.setMarca(marca);
    }

    private br.com.novexa.erp.entity.CategoriaProdutoEntity buscarCategoria(Long id, Long empresaId) {
        if (id == null) return null;
        return categorias.findByIdAndEmpresaId(id, empresaId).orElseThrow(() ->
            new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND,
                "Categoria não encontrada para a empresa informada."));
    }

    private br.com.novexa.erp.entity.SubcategoriaProdutoEntity buscarSubcategoria(Long id, Long empresaId) {
        if (id == null) return null;
        return subcategorias.findByIdAndEmpresaId(id, empresaId).orElseThrow(() ->
            new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND,
                "Subcategoria não encontrada para a empresa informada."));
    }

    private br.com.novexa.erp.entity.MarcaEntity buscarMarca(Long id, Long empresaId) {
        if (id == null) return null;
        return marcas.findByIdAndEmpresaId(id, empresaId).orElseThrow(() ->
            new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND,
                "Marca não encontrada para a empresa informada."));
    }

    private EmpresaEntity buscarEmpresa(Long empresaId) {
        return empresaService.buscarPorId(empresaId);
    }

    private br.com.novexa.erp.entity.FornecedorEntity buscarFornecedor(Long id, Long empresaId) {
        if (id == null) return null;
        return fornecedorRepository.findByIdAndEmpresaId(id, empresaId).orElseThrow(() ->
            new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND,
                "Fornecedor não encontrado para a empresa informada."));
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
