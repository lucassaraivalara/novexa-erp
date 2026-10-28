package br.com.novexa.erp.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public final class AjusteEstoqueLoteDTO {
    private AjusteEstoqueLoteDTO() { }
    public record Item(Long produtoId, BigDecimal valor, BigDecimal saldoEsperado,
                       Long ultimaMovimentacaoIdEsperada) { }
    public record Pedido(String modo, String motivo, UUID chaveRequisicao, List<Item> itens) { }
    public record Linha(Long produtoId, String codigoInterno, String nome, String unidade,
                        BigDecimal saldoAnterior, BigDecimal saldoFinal, BigDecimal diferenca,
                        Long ultimaMovimentacaoId, String status, List<String> erros, Long movimentacaoId) { }
    public record Resultado(UUID chaveRequisicao, List<Linha> itens, int alterados, int semAlteracao) { }
}
