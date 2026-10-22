package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.AnaliseVendasDTO.*;
import br.com.novexa.erp.repository.AnaliseVendasRepository;
import br.com.novexa.erp.time.TempoNovexa;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;

@Service
@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
public class AnaliseVendasService {
    private final AnaliseVendasRepository repository;
    public AnaliseVendasService(AnaliseVendasRepository repository) { this.repository = repository; }

    public Resumo resumo(long empresa, LocalDate inicio, LocalDate fim) {
        validarPeriodo(inicio, fim);
        var agora = TempoNovexa.agora();
        var inicioAnterior = inicio.minusDays(ChronoUnit.DAYS.between(inicio, fim) + 1);
        var fimAnterior = inicio.minusDays(1);
        return new Resumo(new Periodo(inicio, fim, fim.equals(agora.toLocalDate()), agora),
                repository.resumo(empresa, inicio, fim), new Periodo(inicioAnterior, fimAnterior, false, agora),
                repository.resumo(empresa, inicioAnterior, fimAnterior), repository.evolucao(empresa, inicio, fim),
                repository.evolucao(empresa, inicioAnterior, fimAnterior), repository.vendasSemDataFaturamento(empresa));
    }

    private void validarPeriodo(LocalDate inicio, LocalDate fim) {
        if (inicio == null || fim == null || inicio.isAfter(fim) || fim.isAfter(TempoNovexa.hoje())
                || ChronoUnit.DAYS.between(inicio, fim) >= 366 || inicio.getYear() < 1901)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Informe um período válido de até 366 dias, sem datas futuras.");
    }

    public Ranking produtos(long empresa, LocalDate inicio, LocalDate fim, String ordem, String unidade, int page, int size) {
        validarPeriodo(inicio, fim);
        br.com.novexa.erp.util.Paginacao.criar(page, size, "id,asc", java.util.Set.of("id"), org.springframework.data.domain.Sort.Direction.ASC);
        var unidades = validarRanking(empresa, inicio, fim, ordem, unidade);
        BigDecimal total = repository.resumo(empresa, inicio, fim).faturamento();
        return new Ranking(repository.produtos(empresa, inicio, fim, ordem, unidade, page, size, total), unidades, total, repository.itensSemUnidade(empresa, inicio, fim));
    }

    private List<String> validarRanking(long empresa, LocalDate inicio, LocalDate fim, String ordem, String unidade) {
        if (!List.of("valor", "quantidade").contains(ordem)) throw invalido("Ordene por valor ou quantidade.");
        repository.validarItens(empresa, inicio, fim);
        var unidades = repository.unidades(empresa, inicio, fim);
        if ("quantidade".equals(ordem) && (unidade == null || unidade.isBlank()))
            throw invalido("Selecione uma unidade para comparar quantidades compatíveis.");
        if (unidade != null && !unidades.contains(unidade)) throw invalido("Selecione uma unidade presente no período.");
        return unidades;
    }

    public Distribuicao categorias(long empresa, LocalDate inicio, LocalDate fim) {
        validarPeriodo(inicio, fim); repository.validarItens(empresa, inicio, fim);
        var total = repository.resumo(empresa, inicio, fim).faturamento();
        return new Distribuicao(repository.categorias(empresa, inicio, fim, total), total);
    }

    public byte[] exportar(long empresa, LocalDate inicio, LocalDate fim, String secao, String ordem, String unidade) {
        validarPeriodo(inicio, fim);
        var csv = new StringBuilder("\uFEFF");
        // Arquivos separados; não exporta a página visível como se fosse o ranking completo.
        switch (secao) {
            case "resumo" -> {
                var r = resumo(empresa, inicio, fim);
                linha(csv, "Período", "Data inicial", "Data final", "Faturamento", "Quantidade de vendas", "Ticket médio", "Descontos", "Referência temporal", "Incompleto", "Vendas sem data de faturamento (empresa, fora dos períodos)");
                for (boolean anterior : new boolean[]{false, true}) {
                    var p = anterior ? r.periodoAnterior() : r.periodo(); var i = anterior ? r.anterior() : r.atual();
                    linha(csv, anterior ? "Anterior" : "Atual", p.dataInicial(), p.dataFinal(), i.faturamento(), i.quantidadeVendas(), i.ticketMedio(), i.descontos(), "Faturamento efetivo · Brasília", p.incompleto(), r.vendasSemDataFaturamento());
                }
            }
            case "evolucao" -> {
                var r = resumo(empresa, inicio, fim);
                linha(csv, "Dia atual", "Faturamento atual", "Dia anterior", "Faturamento anterior");
                for (int i = 0; i < r.evolucao().size(); i++) linha(csv, r.evolucao().get(i).data(), r.evolucao().get(i).faturamento(), r.evolucaoAnterior().get(i).data(), r.evolucaoAnterior().get(i).faturamento());
            }
            case "produtos" -> {
                validarRanking(empresa, inicio, fim, ordem, unidade);
                var total = repository.resumo(empresa, inicio, fim).faturamento();
                linha(csv, "Produto ID", "Nome histórico", "Unidade histórica", "Quantidade", "Valor vendido", "Participação (%)", "Categoria atual");
                for (var p : repository.produtosExportacao(empresa, inicio, fim, ordem, unidade, null, null, total))
                    linha(csv, p.produtoId(), p.nome(), p.unidade() == null ? "Não registrada" : p.unidade(), p.quantidade(), p.valorVendido(), p.participacao(), p.categoria());
            }
            case "categorias" -> {
                linha(csv, "Categoria ID", "Categoria atual", "Valor vendido", "Participação (%)");
                for (var c : categorias(empresa, inicio, fim).items()) linha(csv, c.categoriaId(), c.nome(), c.valorVendido(), c.participacao());
            }
            default -> throw invalido("Selecione resumo, evolucao, produtos ou categorias para exportar.");
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    private static void linha(StringBuilder csv, Object... valores) {
        for (int i = 0; i < valores.length; i++) {
            if (i > 0) csv.append(';');
            Object valor = valores[i];
            String texto = valor == null ? "" : valor instanceof BigDecimal b ? b.toPlainString().replace('.', ',') : valor.toString();
            if (valor instanceof CharSequence && java.text.Normalizer.normalize(texto, java.text.Normalizer.Form.NFKC)
                    .matches("(?s)^[\\s\\p{Z}\\p{Cc}\\p{Cf}]*[=+@-].*")) texto = "'" + texto;
            csv.append('"').append(texto.replace("\"", "\"\"")).append('"');
        }
        csv.append("\r\n");
    }

    private ResponseStatusException invalido(String mensagem) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, mensagem); }
}
