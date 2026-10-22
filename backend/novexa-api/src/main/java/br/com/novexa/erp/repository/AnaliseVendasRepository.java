package br.com.novexa.erp.repository;

import br.com.novexa.erp.dto.AnaliseVendasDTO.*;
import br.com.novexa.erp.dto.PaginaResponseDTO;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Consultas comerciais somente leitura. Não cruza pagamentos com itens. */
@Repository
public class AnaliseVendasRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public AnaliseVendasRepository(NamedParameterJdbcTemplate jdbc) { this.jdbc = jdbc; }

    private static final String FILTRO = """
            v.empresa_id = :empresa AND v.status = 'FATURADA'
            AND v.data_faturamento >= :inicio AND v.data_faturamento < :fim
            """;

    // Rateio em centavos por maior resto; desempate por ordem/id do item, sem join com pagamentos.
    private static final String RATEIO = """
            WITH base AS (
                SELECT i.id, i.ordem, i.venda_id, i.produto_id, i.quantidade, i.subtotal peso,
                    i.unidade_medida_venda unidade, c.id categoria_id,
                    coalesce(c.nome, 'Sem categoria') categoria,
                    first_value(i.nome_produto) OVER (PARTITION BY i.produto_id, i.unidade_medida_venda
                        ORDER BY v.data_faturamento DESC, v.id DESC, i.id DESC) nome,
                    round(v.total * 100) total_centavos,
                    sum(i.subtotal) OVER (PARTITION BY v.id) soma_itens
                FROM itens_venda i JOIN vendas v ON v.id = i.venda_id
                JOIN produtos p ON p.id = i.produto_id AND p.empresa_id = v.empresa_id
                LEFT JOIN categorias_produtos c ON c.id = p.categoria_id AND c.empresa_id = v.empresa_id
                WHERE %s
            ), cotas AS (
                SELECT *, CASE WHEN soma_itens > 0 THEN total_centavos * peso / soma_itens ELSE 0 END cota FROM base
            ), pisos AS (
                SELECT *, floor(cota) centavos_base FROM cotas
            ), rateados AS (
                SELECT *, centavos_base + CASE WHEN row_number() OVER
                    (PARTITION BY venda_id ORDER BY (cota - centavos_base) DESC, ordem, id)
                    <= total_centavos - sum(centavos_base) OVER (PARTITION BY venda_id)
                    THEN 1 ELSE 0 END centavos FROM pisos
            ), agrupados AS (
                SELECT produto_id, nome, unidade, categoria_id, categoria,
                    CASE WHEN unidade IS NULL THEN NULL ELSE sum(quantidade) END quantidade, sum(centavos) / 100.0 valor
                FROM rateados GROUP BY produto_id, nome, unidade, categoria_id, categoria
            )
            """.formatted(FILTRO);

    private MapSqlParameterSource parametros(long empresa, LocalDate inicio, LocalDate fim) {
        return new MapSqlParameterSource("empresa", empresa)
                .addValue("inicio", java.sql.Timestamp.valueOf(inicio.atStartOfDay()))
                .addValue("fim", java.sql.Timestamp.valueOf(fim.plusDays(1).atStartOfDay()));
    }

    public long vendasSemDataFaturamento(long empresa) {
        return jdbc.queryForObject("SELECT count(*) FROM vendas WHERE empresa_id=:empresa "
                + "AND status='FATURADA' AND data_faturamento IS NULL", Map.of("empresa", empresa), Long.class);
    }

    public long itensSemUnidade(long empresa, LocalDate inicio, LocalDate fim) {
        return jdbc.queryForObject("SELECT count(*) FROM itens_venda i JOIN vendas v ON v.id=i.venda_id WHERE "
                + FILTRO + " AND i.unidade_medida_venda IS NULL", parametros(empresa, inicio, fim), Long.class);
    }

    public Indicadores resumo(long empresa, LocalDate inicio, LocalDate fim) {
        return jdbc.queryForObject("SELECT coalesce(sum(v.total),0) faturamento, count(*) quantidade, "
                        + "coalesce(sum(v.desconto),0) descontos FROM vendas v WHERE " + FILTRO,
                parametros(empresa, inicio, fim), (rs, n) -> {
                    BigDecimal total = rs.getBigDecimal("faturamento");
                    long quantidade = rs.getLong("quantidade");
                    return new Indicadores(total, quantidade, quantidade == 0 ? BigDecimal.ZERO.setScale(2)
                            : total.divide(BigDecimal.valueOf(quantidade), 2, RoundingMode.HALF_UP),
                            rs.getBigDecimal("descontos"));
                });
    }

    public List<Dia> evolucao(long empresa, LocalDate inicio, LocalDate fim) {
        Map<LocalDate, BigDecimal> valores = jdbc.query("SELECT cast(v.data_faturamento AS date) dia, sum(v.total) total "
                        + "FROM vendas v WHERE " + FILTRO + " GROUP BY cast(v.data_faturamento AS date)",
                parametros(empresa, inicio, fim), (rs, n) -> new Dia(rs.getDate("dia").toLocalDate(), rs.getBigDecimal("total")))
                .stream().collect(Collectors.toMap(Dia::data, Dia::faturamento));
        return inicio.datesUntil(fim.plusDays(1)).map(d -> new Dia(d, valores.getOrDefault(d, BigDecimal.ZERO.setScale(2)))).toList();
    }

    public void validarItens(long empresa, LocalDate inicio, LocalDate fim) {
        Long invalidas = jdbc.queryForObject("SELECT count(*) FROM vendas v WHERE " + FILTRO + """
                AND (v.total < 0 OR v.subtotal - coalesce(v.desconto,0) <> v.total
                  OR NOT EXISTS (SELECT 1 FROM itens_venda i WHERE i.venda_id = v.id)
                  OR (SELECT sum(i.subtotal) FROM itens_venda i WHERE i.venda_id = v.id) <> v.subtotal
                  OR EXISTS (SELECT 1 FROM itens_venda i JOIN produtos p ON p.id=i.produto_id
                     WHERE i.venda_id=v.id AND (i.subtotal < 0 OR p.empresa_id <> v.empresa_id)))
                """, parametros(empresa, inicio, fim), Long.class);
        if (invalidas != null && invalidas > 0) throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Há vendas com itens históricos inconsistentes neste período. Revise os registros antes de analisar produtos e categorias.");
    }

    public List<String> unidades(long empresa, LocalDate inicio, LocalDate fim) {
        return jdbc.queryForList(RATEIO + "SELECT DISTINCT unidade FROM agrupados WHERE unidade IS NOT NULL ORDER BY unidade",
                parametros(empresa, inicio, fim), String.class);
    }

    public PaginaResponseDTO<Produto> produtos(long empresa, LocalDate inicio, LocalDate fim, String ordem,
                                               String unidade, int page, int size, BigDecimal faturamento) {
        var params = parametros(empresa, inicio, fim).addValue("unidade", unidade);
        String filtro = unidade == null ? "" : " WHERE unidade = :unidade";
        long total = jdbc.queryForObject(RATEIO + "SELECT count(*) FROM agrupados" + filtro, params, Long.class);
        return new PaginaResponseDTO<>(produtosExportacao(empresa, inicio, fim, ordem, unidade, page, size, faturamento),
                page, size, total, (int) ((total + size - 1) / size));
    }

    public List<Produto> produtosExportacao(long empresa, LocalDate inicio, LocalDate fim, String ordem,
                                            String unidade, Integer page, Integer size, BigDecimal faturamento) {
        var params = parametros(empresa, inicio, fim).addValue("unidade", unidade);
        String filtro = unidade == null ? "" : " WHERE unidade = :unidade";
        // Ordenação é allowlist interna. Valores e limites continuam parâmetros JDBC.
        String ordenacao = "quantidade".equals(ordem) ? "quantidade DESC, valor DESC, produto_id, unidade NULLS LAST" : "valor DESC, produto_id, unidade NULLS LAST";
        String limite = "";
        if (page != null && size != null) {
            limite = " LIMIT :limite OFFSET :offset";
            params.addValue("limite", size).addValue("offset", (long) page * size);
        }
        return jdbc.query(RATEIO + "SELECT * FROM agrupados" + filtro + " ORDER BY " + ordenacao + limite, params,
                (rs, n) -> new Produto(rs.getLong("produto_id"), rs.getString("nome"), rs.getString("unidade"),
                        rs.getBigDecimal("quantidade"), rs.getBigDecimal("valor").setScale(2),
                        participacao(rs.getBigDecimal("valor"), faturamento), rs.getString("categoria")));
    }

    public List<Categoria> categorias(long empresa, LocalDate inicio, LocalDate fim, BigDecimal faturamento) {
        return jdbc.query(RATEIO + "SELECT categoria_id, categoria, sum(valor) valor FROM agrupados "
                        + "GROUP BY categoria_id, categoria ORDER BY valor DESC, categoria_id NULLS LAST",
                parametros(empresa, inicio, fim), (rs, n) -> new Categoria(rs.getObject("categoria_id", Long.class),
                        rs.getString("categoria"), rs.getBigDecimal("valor").setScale(2), participacao(rs.getBigDecimal("valor"), faturamento)));
    }

    private BigDecimal participacao(BigDecimal valor, BigDecimal total) {
        return total.signum() == 0 ? BigDecimal.ZERO.setScale(2) : valor.multiply(BigDecimal.valueOf(100)).divide(total, 2, RoundingMode.HALF_UP);
    }
}
