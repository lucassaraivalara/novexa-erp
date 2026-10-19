package br.com.novexa.erp.mapper;

import br.com.novexa.erp.dto.ProdutoRequestDTO;
import br.com.novexa.erp.dto.ProdutoResponseDTO;
import br.com.novexa.erp.entity.ProdutoEntity;
import br.com.novexa.erp.storage.ArquivoStorageService;
import org.springframework.stereotype.Component;

@Component
public class ProdutoMapper {

    private final ArquivoStorageService arquivoStorageService;

    public ProdutoMapper(ArquivoStorageService arquivoStorageService) {
        this.arquivoStorageService = arquivoStorageService;
    }

    public ProdutoEntity toEntity(ProdutoRequestDTO request) {
        ProdutoEntity produto = new ProdutoEntity();
        preencherDados(request, produto);
        return produto;
    }

    public void atualizarEntity(ProdutoRequestDTO request, ProdutoEntity produto) {
        preencherDados(request, produto);
    }

    public ProdutoResponseDTO toResponse(ProdutoEntity produto) {
        ProdutoResponseDTO response = new ProdutoResponseDTO();

        response.setId(produto.getId());
        response.setNcm(produto.getNcm()); response.setCest(produto.getCest());
        response.setEmpresaId(produto.getEmpresa().getId());
        response.setFornecedor(br.com.novexa.erp.dto.FornecedorProdutoResponseDTO.de(produto.getFornecedorPrincipal()));
        response.setCategoria(produto.getCategoria() == null ? null : br.com.novexa.erp.dto.CategoriaProdutoResponseDTO.de(produto.getCategoria()));
        response.setSubcategoria(produto.getSubcategoria() == null ? null : br.com.novexa.erp.dto.SubcategoriaProdutoResponseDTO.de(produto.getSubcategoria()));
        response.setMarca(produto.getMarca() == null ? null : br.com.novexa.erp.dto.MarcaResponseDTO.de(produto.getMarca()));
        response.setCodigoInterno(produto.getCodigoInterno());
        response.setCodigoBarras(produto.getCodigoBarras());
        response.setNome(produto.getNome());
        response.setDescricao(produto.getDescricao());
        response.setUnidadeMedida(produto.getUnidadeMedida());
        response.setComposto(produto.isComposto()); response.setComposicaoVersao(produto.getComposicaoVersao());
        response.setPrecoCusto(produto.getCustoCalculado());
        response.setPrecoVenda(produto.getPrecoVenda());
        response.setEstoqueAtual(produto.getSaldoDisponivel());
        response.setEstoqueMinimo(produto.getEstoqueMinimo());
        response.setControlaEstoque(produto.getControlaEstoque());
        response.setImagemPath(produto.getImagemPath());
        response.setImagemUrl(arquivoStorageService.obterUrlPublica(produto.getImagemPath()));
        response.setAtivo(produto.getAtivo());
        response.setDataCadastro(produto.getDataCadastro());

        return response;
    }

    private void preencherDados(ProdutoRequestDTO request, ProdutoEntity produto) {
        produto.setCodigoInterno(request.getCodigoInterno());
        produto.setCodigoBarras(request.getCodigoBarras());
        produto.setNome(request.getNome());
        produto.setNcm(request.getNcm()); produto.setCest(request.getCest());
        produto.setDescricao(request.getDescricao());
        produto.setUnidadeMedida(request.getUnidadeMedida());
        produto.setPrecoCusto(request.getPrecoCusto());
        produto.setPrecoVenda(request.getPrecoVenda());
        produto.setEstoqueMinimo(request.getEstoqueMinimo());
        produto.setControlaEstoque(request.getControlaEstoque());
        produto.setAtivo(request.getAtivo());
    }
}
