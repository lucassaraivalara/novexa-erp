package br.com.novexa.erp.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class AnaliseVendasDTO {
    private AnaliseVendasDTO() { }

    public record Periodo(LocalDate dataInicial, LocalDate dataFinal, boolean incompleto,
                          LocalDateTime geradoEm) { }
    public record Indicadores(BigDecimal faturamento, long quantidadeVendas,
                              BigDecimal ticketMedio, BigDecimal descontos) { }
    public record Dia(LocalDate data, BigDecimal faturamento) { }
    public record Resumo(Periodo periodo, Indicadores atual, Periodo periodoAnterior,
                         Indicadores anterior, List<Dia> evolucao, List<Dia> evolucaoAnterior, long vendasSemDataFaturamento) { }
    public record Produto(Long produtoId, String nome, String unidade, BigDecimal quantidade,
                          BigDecimal valorVendido, BigDecimal participacao, String categoria) { }
    public record Ranking(PaginaResponseDTO<Produto> pagina, List<String> unidades, BigDecimal faturamentoPeriodo, long itensSemUnidade) { }
    public record Categoria(Long categoriaId, String nome, BigDecimal valorVendido, BigDecimal participacao) { }
    public record Distribuicao(List<Categoria> items, BigDecimal faturamentoPeriodo) { }
}
