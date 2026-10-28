package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.AjusteEstoqueLoteDTO;
import br.com.novexa.erp.dto.ImportacaoEstoqueDTO;
import br.com.novexa.erp.security.UsuarioAutenticado;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.util.*;

import static br.com.novexa.erp.dto.AjusteEstoqueLoteDTO.*;

@Service
public class ImportacaoEstoqueService {
    private record ProdutoCodigo(long id, String interno, String barras, String nome) { }
    private final PlanilhaEstoqueParser parser;
    private final NamedParameterJdbcTemplate jdbc;
    private final AjusteEstoqueLoteService ajustes;

    public ImportacaoEstoqueService(PlanilhaEstoqueParser parser, NamedParameterJdbcTemplate jdbc, AjusteEstoqueLoteService ajustes) {
        this.parser = parser; this.jdbc = jdbc; this.ajustes = ajustes;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ImportacaoEstoqueDTO.Previa previa(MultipartFile arquivo, String motivo, UsuarioAutenticado usuario) {
        ajustes.validarAcesso(usuario);
        if (motivo == null || motivo.isBlank() || motivo.trim().length() > 255)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o motivo obrigatório, com até 255 caracteres.");
        if (arquivo == null || arquivo.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecione um arquivo CSV ou XLSX não vazio.");
        if (arquivo.getSize() > PlanilhaEstoqueParser.MAX_BYTES) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "O arquivo excede o limite de 2 MiB.");
        final PlanilhaEstoqueParser.Planilha planilha;
        try { planilha = parser.parse(arquivo.getOriginalFilename(), arquivo.getBytes()); }
        catch (java.io.IOException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Não foi possível ler o arquivo enviado."); }

        List<PlanilhaEstoqueParser.Linha> linhas = planilha.linhas();
        List<String> codigos = linhas.stream().filter(l -> l.erros().isEmpty()).map(PlanilhaEstoqueParser.Linha::codigo).distinct().toList();
        Map<String, List<ProdutoCodigo>> encontrados = new HashMap<>();
        if (!codigos.isEmpty()) jdbc.query("""
            select p.id,p.codigo_interno,p.codigo_barras,p.nome from produtos p
            where p.empresa_id=:empresa and (p.codigo_interno in (:codigos) or p.codigo_barras in (:codigos))
            """, Map.of("empresa", usuario.empresaId(), "codigos", codigos), rs -> {
                ProdutoCodigo p = new ProdutoCodigo(rs.getLong("id"), rs.getString("codigo_interno"), rs.getString("codigo_barras"), rs.getString("nome"));
                if (p.interno() != null) encontrados.computeIfAbsent(p.interno(), k -> new ArrayList<>()).add(p);
                if (p.barras() != null && !Objects.equals(p.interno(), p.barras())) encontrados.computeIfAbsent(p.barras(), k -> new ArrayList<>()).add(p);
            });

        Long[] ids = new Long[linhas.size()]; List<Item> itens = new ArrayList<>(); List<Integer> indices = new ArrayList<>();
        List<List<String>> erros = new ArrayList<>(); List<ProdutoCodigo> produtos = new ArrayList<>();
        Map<Long, Integer> usos = new HashMap<>();
        for (int i = 0; i < linhas.size(); i++) {
            var l = linhas.get(i); List<String> e = new ArrayList<>(l.erros()); ProdutoCodigo p = null;
            if (e.isEmpty()) {
                List<ProdutoCodigo> matches = encontrados.getOrDefault(l.codigo(), List.of());
                Map<Long, ProdutoCodigo> unicos = new LinkedHashMap<>(); matches.forEach(x -> unicos.put(x.id(), x));
                if (unicos.isEmpty()) e.add("Código não encontrado para esta empresa.");
                else if (unicos.size() > 1) e.add("Código ambíguo; confira o cadastro do produto.");
                else { p = unicos.values().iterator().next(); ids[i] = p.id(); usos.merge(p.id(), 1, Integer::sum); }
            }
            erros.add(e); produtos.add(p);
        }
        for (int i = 0; i < linhas.size(); i++) if (ids[i] != null && usos.get(ids[i]) > 1) erros.get(i).add("Produto repetido no arquivo, mesmo com códigos diferentes.");
        for (int i = 0; i < linhas.size(); i++) if (ids[i] != null && erros.get(i).isEmpty()) {
            itens.add(new Item(ids[i], linhas.get(i).quantidade(), null, null)); indices.add(i);
        }
        Resultado lote = itens.isEmpty() ? new Resultado(null, List.of(), 0, 0)
                : ajustes.previa(new Pedido("SALDO_FINAL", motivo.trim(), null, itens), usuario);
        for (int j = 0; j < indices.size(); j++) {
            int i = indices.get(j); AjusteEstoqueLoteDTO.Linha l = lote.itens().get(j);
            erros.get(i).addAll(l.erros());
        }
        List<ImportacaoEstoqueDTO.Linha> resultado = new ArrayList<>(); int identificados = 0, validos = 0, invalidos = 0, diferenca = 0, iguais = 0;
        for (int i = 0; i < linhas.size(); i++) {
            var origem = linhas.get(i); ProdutoCodigo produto = produtos.get(i); Long id = ids[i];
            AjusteEstoqueLoteDTO.Linha estado = null;
            for (int j = 0; j < indices.size(); j++) if (indices.get(j) == i) { estado = lote.itens().get(j); break; }
            if (id != null) identificados++;
            boolean ok = erros.get(i).isEmpty() && estado != null && !"INVALIDO".equals(estado.status());
            if (ok) { validos++; if ("SEM_ALTERACAO".equals(estado.status())) iguais++; else diferenca++; } else invalidos++;
            String situacao = !ok ? "INVALIDO" : "SEM_ALTERACAO".equals(estado.status()) ? "SEM_ALTERACAO" : "VALIDO";
            resultado.add(new ImportacaoEstoqueDTO.Linha(origem.numero(), origem.codigo(), origem.descricao(), id,
                    estado != null ? estado.nome() : produto != null ? produto.nome() : null,
                    estado == null || estado.saldoAnterior() == null ? null : estado.saldoAnterior().toPlainString(),
                    origem.quantidade() == null ? null : origem.quantidade().toPlainString(),
                    estado == null || estado.diferenca() == null ? null : estado.diferenca().toPlainString(),
                    estado == null ? null : estado.ultimaMovimentacaoId(), situacao, List.copyOf(erros.get(i))));
        }
        return new ImportacaoEstoqueDTO.Previa(List.copyOf(resultado),
                new ImportacaoEstoqueDTO.Totais(linhas.size(), identificados, validos, invalidos, diferenca, iguais), lote);
    }
}
