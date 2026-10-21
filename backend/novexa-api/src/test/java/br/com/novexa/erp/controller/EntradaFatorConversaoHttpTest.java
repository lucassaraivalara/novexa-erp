package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.ProdutoFornecedorRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class EntradaFatorConversaoHttpTest extends EntradaMercadoriaHttpTest {
    @Autowired ProdutoFornecedorRepository vinculos;

    void vinculo(ProdutoEntity p, FornecedorEntity f, String codigo, String fator) {
        var v = new ProdutoFornecedorEntity();
        v.setEmpresa(empresa); v.setProduto(p); v.setFornecedor(f); v.setCodigoReferencia(codigo);
        if (fator != null) v.setFatorConversao(new BigDecimal(fator));
        vinculos.saveAndFlush(v);
    }

    @Test void confirmaCreditaQuantidadeVezesFatorECustoPorUnidade() throws Exception {
        vinculo(produto, fornecedor, "FAB-20", "20");
        long id = id(criar(pedido()).andExpect(status().isCreated())
                .andExpect(jsonPath("$.itens[0].fatorConversao").value(20)));
        operacao(id, "confirmar").andExpect(status().isOk());
        assertThat(saldo(produto)).isEqualByComparingTo("110"); // 10 + 5 embalagens x 20
        assertThat(produtos.findById(produto.getId()).orElseThrow().getPrecoCusto()).isEqualByComparingTo("0.18");
    }

    @Test void cancelarReverteExatamenteAQuantidadeEfetiva() throws Exception {
        vinculo(produto, fornecedor, null, "20");
        long id = criarEntrada();
        operacao(id, "confirmar").andExpect(status().isOk());
        assertThat(saldo(produto)).isEqualByComparingTo("110");
        operacao(id, "cancelar").andExpect(status().isOk());
        assertThat(saldo(produto)).isEqualByComparingTo("10");
    }

    @Test void memorizaCodigoFornecedorAoConfirmarSemSobrescreverCodigoExistente() throws Exception {
        var pedido = pedido();
        var i = item(produto, "5", "3.50");
        i.put("codigoProdutoFornecedor", "FAB-9");
        pedido.put("itens", java.util.List.of(i));
        long id = id(criar(pedido).andExpect(status().isCreated()));
        operacao(id, "confirmar").andExpect(status().isOk());
        var criado = vinculos.findByProdutoIdAndFornecedorIdAndEmpresaId(produto.getId(), fornecedor.getId(), empresa.getId()).orElseThrow();
        assertThat(criado.getCodigoReferencia()).isEqualTo("FAB-9");
        assertThat(criado.getFatorConversao()).isNull();

        vinculo(produto2, fornecedor, "ORIGINAL", null);
        var pedido2 = pedido();
        var i2 = item(produto2, "1", "2.00");
        i2.put("codigoProdutoFornecedor", "NOVO");
        pedido2.put("itens", java.util.List.of(i2));
        long id2 = id(criar(pedido2).andExpect(status().isCreated()));
        operacao(id2, "confirmar").andExpect(status().isOk());
        var mantido = vinculos.findByProdutoIdAndFornecedorIdAndEmpresaId(produto2.getId(), fornecedor.getId(), empresa.getId()).orElseThrow();
        assertThat(mantido.getCodigoReferencia()).isEqualTo("ORIGINAL");
    }

    @Test void semVinculoMantemFatorUmEComportamentoAtual() throws Exception {
        long id = id(criar(pedido()).andExpect(status().isCreated())
                .andExpect(jsonPath("$.itens[0].fatorConversao").value(1)));
        operacao(id, "confirmar").andExpect(status().isOk());
        assertThat(saldo(produto)).isEqualByComparingTo("15");
        assertThat(produtos.findById(produto.getId()).orElseThrow().getPrecoCusto()).isEqualByComparingTo("3.50");
    }

    @Test void edicaoAtualizaSnapshotDoFatorDoVinculo() throws Exception {
        long id = criarEntrada(); // rascunho sem vinculo: fator 1
        vinculo(produto, fornecedor, null, "4");
        editar(id, pedido()).andExpect(status().isOk())
                .andExpect(jsonPath("$.itens[0].fatorConversao").value(4));
        operacao(id, "confirmar").andExpect(status().isOk());
        assertThat(saldo(produto)).isEqualByComparingTo("30"); // 10 + 5 x 4
    }
}
