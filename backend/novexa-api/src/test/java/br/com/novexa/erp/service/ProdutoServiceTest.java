package br.com.novexa.erp.service;

import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.entity.ProdutoEntity;
import br.com.novexa.erp.exception.ProdutoCodigoDuplicadoException;
import br.com.novexa.erp.exception.ProdutoInvalidoException;
import br.com.novexa.erp.exception.ProdutoNotFoundException;
import br.com.novexa.erp.repository.ProdutoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProdutoServiceTest {

    @Mock
    private ProdutoRepository produtoRepository;

    @Mock
    private EmpresaService empresaService;

    private ProdutoService produtoService;

    @BeforeEach
    void configurar() {
        produtoService = new ProdutoService(produtoRepository, empresaService);
    }

    @Test
    void deveSalvarProdutoComEmpresaEValoresBigDecimal() {
        EmpresaEntity empresa = criarEmpresa(2L);
        ProdutoEntity produto = criarProduto();

        when(empresaService.buscarPorId(2L)).thenReturn(empresa);
        when(produtoRepository.existsByEmpresaIdAndCodigoInterno(2L, "SKU-001"))
                .thenReturn(false);
        when(produtoRepository.existsByEmpresaIdAndCodigoBarras(2L, "7891234567890"))
                .thenReturn(false);
        when(produtoRepository.save(any(ProdutoEntity.class)))
                .thenAnswer(invocacao -> invocacao.getArgument(0));

        ProdutoEntity produtoSalvo = produtoService.salvar(produto, 2L);

        assertThat(produtoSalvo.getEmpresa()).isSameAs(empresa);
        assertThat(produtoSalvo.getPrecoVenda()).isEqualByComparingTo("19.90");
        assertThat(produtoSalvo.getEstoqueAtual()).isEqualByComparingTo("10.000");
    }

    @Test
    void deveRecusarCodigoInternoDuplicadoNaMesmaEmpresa() {
        EmpresaEntity empresa = criarEmpresa(2L);
        ProdutoEntity produto = criarProduto();

        when(empresaService.buscarPorId(2L)).thenReturn(empresa);
        when(produtoRepository.existsByEmpresaIdAndCodigoInterno(2L, "SKU-001"))
                .thenReturn(true);

        assertThatThrownBy(() -> produtoService.salvar(produto, 2L))
                .isInstanceOf(ProdutoCodigoDuplicadoException.class)
                .hasMessage("Já existe um produto com este código interno na empresa informada.");
    }

    @Test
    void deveRecusarCodigoBarrasDuplicadoNaMesmaEmpresa() {
        EmpresaEntity empresa = criarEmpresa(2L);
        ProdutoEntity produto = criarProduto();
        produto.setCodigoInterno(null);

        when(empresaService.buscarPorId(2L)).thenReturn(empresa);
        when(produtoRepository.existsByEmpresaIdAndCodigoBarras(2L, "7891234567890"))
                .thenReturn(true);

        assertThatThrownBy(() -> produtoService.salvar(produto, 2L))
                .isInstanceOf(ProdutoCodigoDuplicadoException.class)
                .hasMessage("Já existe um produto com este código de barras na empresa informada.");
    }

    @Test
    void deveRecusarValoresNegativos() {
        EmpresaEntity empresa = criarEmpresa(2L);
        ProdutoEntity produto = criarProduto();
        produto.setPrecoVenda(new BigDecimal("-0.01"));

        when(empresaService.buscarPorId(2L)).thenReturn(empresa);

        assertThatThrownBy(() -> produtoService.salvar(produto, 2L))
                .isInstanceOf(ProdutoInvalidoException.class)
                .hasMessage("O preço de venda não pode ser negativo.");
    }

    @Test
    void deveImpedirBuscaDeProdutoDeOutraEmpresa() {
        EmpresaEntity empresa = criarEmpresa(2L);

        when(empresaService.buscarPorId(2L)).thenReturn(empresa);
        when(produtoRepository.findByIdAndEmpresaId(1L, 2L))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> produtoService.buscarPorId(1L, 2L))
                .isInstanceOf(ProdutoNotFoundException.class)
                .hasMessage("Produto não encontrado para a empresa informada.");
    }

    @Test
    void deveInativarProdutoSemExcluiLoDoBanco() {
        EmpresaEntity empresa = criarEmpresa(2L);
        ProdutoEntity produto = criarProduto();
        produto.setEmpresa(empresa);
        produto.setAtivo(true);

        when(empresaService.buscarPorId(2L)).thenReturn(empresa);
        when(produtoRepository.findByIdAndEmpresaId(1L, 2L))
                .thenReturn(Optional.of(produto));

        produtoService.inativar(1L, 2L);

        assertThat(produto.getAtivo()).isFalse();
        verify(produtoRepository).save(produto);
    }

    private EmpresaEntity criarEmpresa(Long id) {
        EmpresaEntity empresa = new EmpresaEntity();
        empresa.setId(id);
        empresa.setAtivo(true);
        return empresa;
    }

    private ProdutoEntity criarProduto() {
        ProdutoEntity produto = new ProdutoEntity();
        produto.setCodigoInterno("sku-001");
        produto.setCodigoBarras("7891234567890");
        produto.setNome("Produto de teste");
        produto.setUnidadeMedida("un");
        produto.setPrecoCusto(new BigDecimal("10.00"));
        produto.setPrecoVenda(new BigDecimal("19.90"));
        produto.setEstoqueAtual(new BigDecimal("10.000"));
        produto.setEstoqueMinimo(new BigDecimal("2.000"));
        produto.setControlaEstoque(true);
        produto.setAtivo(true);
        return produto;
    }
}
