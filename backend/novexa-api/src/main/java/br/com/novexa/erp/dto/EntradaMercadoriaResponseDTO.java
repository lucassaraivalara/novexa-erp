package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record EntradaMercadoriaResponseDTO(
        Long id, Long fornecedorId, String fornecedorNome, OrigemEntradaMercadoria origem,
        StatusEntradaMercadoria status, String numeroNota, String serie, String chaveAcessoNfe,
        LocalDate dataEmissao, LocalDate dataEntrada, BigDecimal valorProdutos, BigDecimal valorTotal,
        String observacao, LocalDateTime dataCadastro, LocalDateTime dataAtualizacao,
        Long usuarioCadastroId, Long usuarioConfirmacaoId, Long usuarioCancelamentoId,
        LocalDateTime dataConfirmacao, LocalDateTime dataCancelamento, List<Item> itens
) {
    public static EntradaMercadoriaResponseDTO de(EntradaMercadoriaEntity e, boolean detalhe) {
        return new EntradaMercadoriaResponseDTO(e.getId(), e.getFornecedor().getId(), e.getFornecedor().getRazaoSocial(),
                e.getOrigem(), e.getStatus(), e.getNumeroNota(), e.getSerie(), e.getChaveAcessoNfe(), e.getDataEmissao(),
                e.getDataEntrada(), e.getValorProdutos(), e.getValorTotal(), e.getObservacao(), e.getDataCadastro(),
                e.getDataAtualizacao(), e.getUsuarioCadastroId(), e.getUsuarioConfirmacaoId(), e.getUsuarioCancelamentoId(),
                e.getDataConfirmacao(), e.getDataCancelamento(), detalhe ? e.getItens().stream().map(Item::de).toList() : null);
    }
    public record Item(Long id, Long produtoId, String produtoNome, String descricaoOriginal,
            String codigoProdutoFornecedor, BigDecimal quantidade, BigDecimal valorUnitario, BigDecimal valorTotal,
            String gtin, String ncm, String cfop, String unidade, Long movimentacaoEstoqueId, Long movimentacaoCancelamentoId) {
        static Item de(ItemEntradaMercadoriaEntity i) {
            return new Item(i.getId(), i.getProduto().getId(), i.getProduto().getNome(), i.getDescricaoOriginal(),
                    i.getCodigoProdutoFornecedor(), i.getQuantidade(), i.getValorUnitario(), i.getValorTotal(),
                    i.getGtin(), i.getNcm(), i.getCfop(), i.getUnidade(), i.getMovimentacaoEstoqueId(), i.getMovimentacaoCancelamentoId());
        }
    }
}
