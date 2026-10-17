package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.util.Paginacao;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.Locale;
import java.util.Set;

@Service
@Transactional(readOnly = true)
public class CategoriaProdutoService {
    private final CategoriaProdutoRepository categorias;
    private final SubcategoriaProdutoRepository subcategorias;
    private final EmpresaRepository empresas;

    public CategoriaProdutoService(CategoriaProdutoRepository categorias, SubcategoriaProdutoRepository subcategorias,
                                    EmpresaRepository empresas) {
        this.categorias = categorias; this.subcategorias = subcategorias; this.empresas = empresas;
    }

    public PaginaResponseDTO<CategoriaProdutoResponseDTO> listar(Long empresaId, String termo, Boolean ativo,
                                                               int page, int size, String sort) {
        return PaginaResponseDTO.de(categorias.listar(empresaId, busca(termo), ativo,
                Paginacao.criar(page, size, sort, Set.of("id", "nome", "ativo"), Sort.Direction.ASC)), CategoriaProdutoResponseDTO::de);
    }
    public CategoriaProdutoResponseDTO consultar(Long id, Long empresaId) { return CategoriaProdutoResponseDTO.de(categoria(id, empresaId)); }

    @Transactional
    public CategoriaProdutoResponseDTO salvar(Long id, Long empresaId, CategoriaProdutoRequestDTO pedido) {
        var existente = id == null ? null : categoria(id, empresaId);
        String nome = pedido.nome().trim();
        if (categorias.existsByEmpresaIdAndNomeIgnoreCaseAndIdNot(empresaId, nome, id == null ? -1L : id))
            throw conflito("Já existe uma categoria com este nome nesta empresa.");
        if (existente == null) existente = new CategoriaProdutoEntity(empresa(empresaId), nome, pedido.ativo() == null || pedido.ativo());
        else existente.atualizar(nome, pedido.ativo() == null ? existente.isAtivo() : pedido.ativo());
        return CategoriaProdutoResponseDTO.de(categorias.saveAndFlush(existente));
    }

    @Transactional
    public void excluir(Long id, Long empresaId) {
        var existente = categoria(id, empresaId);
        if (subcategorias.existsByCategoriaIdAndEmpresaId(id, empresaId))
            throw conflito("Categoria possui subcategorias. Remova ou transfira os vínculos antes de excluir.");
        categorias.delete(existente); categorias.flush();
    }

    public PaginaResponseDTO<SubcategoriaProdutoResponseDTO> listarSubcategorias(Long empresaId, String termo, Boolean ativo,
            Long categoriaId, int page, int size, String sort) {
        if (categoriaId != null) categoria(categoriaId, empresaId);
        return PaginaResponseDTO.de(subcategorias.listar(empresaId, busca(termo), ativo, categoriaId,
                Paginacao.criar(page, size, sort, Set.of("id", "nome", "ativo"), Sort.Direction.ASC)), SubcategoriaProdutoResponseDTO::de);
    }
    public SubcategoriaProdutoResponseDTO consultarSubcategoria(Long id, Long empresaId) {
        return SubcategoriaProdutoResponseDTO.de(subcategoria(id, empresaId));
    }

    @Transactional
    public SubcategoriaProdutoResponseDTO salvarSubcategoria(Long id, Long empresaId, SubcategoriaProdutoRequestDTO pedido) {
        var existente = id == null ? null : subcategoria(id, empresaId);
        var categoria = categoria(pedido.categoriaId(), empresaId);
        String nome = pedido.nome().trim();
        if (subcategorias.existsByEmpresaIdAndNomeIgnoreCaseAndIdNot(empresaId, nome, id == null ? -1L : id))
            throw conflito("Já existe uma subcategoria com este nome nesta empresa.");
        if (existente == null) existente = new SubcategoriaProdutoEntity(empresa(empresaId), categoria, nome, pedido.ativo() == null || pedido.ativo());
        else existente.atualizar(categoria, nome, pedido.ativo() == null ? existente.isAtivo() : pedido.ativo());
        return SubcategoriaProdutoResponseDTO.de(subcategorias.saveAndFlush(existente));
    }

    @Transactional
    public void excluirSubcategoria(Long id, Long empresaId) {
        subcategorias.delete(subcategoria(id, empresaId)); subcategorias.flush();
    }

    private CategoriaProdutoEntity categoria(Long id, Long empresaId) {
        return categorias.findByIdAndEmpresaId(id, empresaId).orElseThrow(() -> naoEncontrado("Categoria"));
    }
    private SubcategoriaProdutoEntity subcategoria(Long id, Long empresaId) {
        return subcategorias.findByIdAndEmpresaId(id, empresaId).orElseThrow(() -> naoEncontrado("Subcategoria"));
    }
    private EmpresaEntity empresa(Long id) { return empresas.findById(id).orElseThrow(() -> naoEncontrado("Empresa")); }
    private static String busca(String termo) {
        String texto = termo == null ? "" : termo.trim().toLowerCase(Locale.ROOT);
        return "%" + texto.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
    }
    private static ResponseStatusException naoEncontrado(String tipo) { return new ResponseStatusException(HttpStatus.NOT_FOUND, tipo + " não encontrada."); }
    private static ResponseStatusException conflito(String mensagem) { return new ResponseStatusException(HttpStatus.CONFLICT, mensagem); }
}
