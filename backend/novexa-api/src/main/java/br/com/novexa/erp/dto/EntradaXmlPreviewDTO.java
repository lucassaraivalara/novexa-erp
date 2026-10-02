package br.com.novexa.erp.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record EntradaXmlPreviewDTO(
        FornecedorXml fornecedorXml, FornecedorMatch fornecedorMatch,
        String numeroNota, String serie, String chaveAcessoNfe, LocalDate dataEmissao,
        BigDecimal valorProdutos, BigDecimal valorTotal, List<Item> itens
) {
    public record FornecedorXml(String cpfCnpj, String razaoSocial, String nomeFantasia) { }
    public record FornecedorMatch(Long id, String razaoSocial, boolean ativo) { }
    public record ProdutoMatch(Long id, String nome, String codigoBarras) { }
    public record Item(String codigoProdutoFornecedor, String descricaoOriginal, String gtin,
            String ncm, String cfop, String unidade, BigDecimal quantidade, BigDecimal valorUnitario,
            BigDecimal valorTotal, ProdutoMatch produtoMatch) {
        public Item comMatch(ProdutoMatch match) {
            return new Item(codigoProdutoFornecedor, descricaoOriginal, gtin, ncm, cfop, unidade,
                    quantidade, valorUnitario, valorTotal, match);
        }
    }
}
