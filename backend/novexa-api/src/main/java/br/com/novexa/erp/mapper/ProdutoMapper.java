package br.com.novexa.erp.mapper;

import br.com.novexa.erp.dto.ProdutoRequestDTO;
import br.com.novexa.erp.dto.ProdutoResponseDTO;
import br.com.novexa.erp.entity.ProdutoEntity;
import org.springframework.stereotype.Component;

@Component
public class ProdutoMapper {

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
        response.setEmpresaId(produto.getEmpresa().getId());
        response.setCodigoInterno(produto.getCodigoInterno());
        response.setCodigoBarras(produto.getCodigoBarras());
        response.setNome(produto.getNome());
        response.setDescricao(produto.getDescricao());
        response.setUnidadeMedida(produto.getUnidadeMedida());
        response.setPrecoCusto(produto.getPrecoCusto());
        response.setPrecoVenda(produto.getPrecoVenda());
        response.setEstoqueAtual(produto.getEstoqueAtual());
        response.setEstoqueMinimo(produto.getEstoqueMinimo());
        response.setControlaEstoque(produto.getControlaEstoque());
        response.setAtivo(produto.getAtivo());
        response.setDataCadastro(produto.getDataCadastro());

        return response;
    }

    private void preencherDados(ProdutoRequestDTO request, ProdutoEntity produto) {
        produto.setCodigoInterno(request.getCodigoInterno());
        produto.setCodigoBarras(request.getCodigoBarras());
        produto.setNome(request.getNome());
        produto.setDescricao(request.getDescricao());
        produto.setUnidadeMedida(request.getUnidadeMedida());
        produto.setPrecoCusto(request.getPrecoCusto());
        produto.setPrecoVenda(request.getPrecoVenda());
        produto.setEstoqueAtual(request.getEstoqueAtual());
        produto.setEstoqueMinimo(request.getEstoqueMinimo());
        produto.setControlaEstoque(request.getControlaEstoque());
        produto.setAtivo(request.getAtivo());
    }
}
