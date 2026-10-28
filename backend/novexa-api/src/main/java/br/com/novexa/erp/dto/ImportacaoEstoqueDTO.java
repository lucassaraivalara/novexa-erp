package br.com.novexa.erp.dto;

import br.com.novexa.erp.dto.AjusteEstoqueLoteDTO.Resultado;
import java.math.BigDecimal;
import java.util.List;

public final class ImportacaoEstoqueDTO {
    private ImportacaoEstoqueDTO() { }
    public record Linha(int linha, String codigo, String descricaoPlanilha, Long produtoId, String produto,
                        String saldoAtual, String quantidade, String diferenca, Long ultimaMovimentacaoId,
                        String situacao, List<String> erros) { }
    public record Totais(int linhas, int identificados, int validos, int invalidos, int comDiferenca, int semAlteracao) { }
    public record Previa(List<Linha> linhas, Totais totais, Resultado lote) { }
}
