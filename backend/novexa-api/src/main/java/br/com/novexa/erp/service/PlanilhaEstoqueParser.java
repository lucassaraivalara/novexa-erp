package br.com.novexa.erp.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.w3c.dom.*;
import org.xml.sax.InputSource;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.*;
import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.charset.*;
import java.text.Normalizer;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/** Parser restrito para a planilha de contagem; nunca avalia conteúdo do arquivo. */
@Component
public final class PlanilhaEstoqueParser {
    public static final int MAX_BYTES = 2 * 1024 * 1024;
    public static final int MAX_LINHAS = 200;
    private static final int MAX_ENTRADAS_ZIP = 64;
    private static final int MAX_XML_EXPANDIDO = 8 * 1024 * 1024;
    private static final String MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

    public record Linha(int numero, String codigo, String descricao, BigDecimal quantidade, List<String> erros) { }
    public record Planilha(List<Linha> linhas) { }

    public Planilha parse(String filename, byte[] bytes) {
        if (bytes == null || bytes.length == 0) throw erro(HttpStatus.BAD_REQUEST, "Arquivo vazio.");
        if (bytes.length > MAX_BYTES) throw erro(HttpStatus.PAYLOAD_TOO_LARGE, "O arquivo excede o limite de 2 MiB.");
        String nome = filename == null ? "" : filename.toLowerCase(Locale.ROOT);
        if (nome.endsWith(".csv")) {
            if (isZip(bytes)) throw erro(HttpStatus.BAD_REQUEST, "A extensão CSV não corresponde ao conteúdo do arquivo.");
            return csv(bytes);
        }
        if (nome.endsWith(".xlsx")) {
            if (!isZip(bytes)) throw erro(HttpStatus.BAD_REQUEST, "A extensão XLSX não corresponde ao conteúdo do arquivo.");
            return xlsx(bytes);
        }
        throw erro(HttpStatus.BAD_REQUEST, "Envie um arquivo CSV ou XLSX.");
    }

    private Planilha csv(byte[] bytes) {
        String texto;
        try {
            CharsetDecoder decoder = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT);
            texto = decoder.decode(ByteBuffer.wrap(bytes)).toString();
        } catch (CharacterCodingException e) { throw erro(HttpStatus.BAD_REQUEST, "CSV inválido: use UTF-8."); }
        if (!texto.isEmpty() && texto.charAt(0) == '\ufeff') texto = texto.substring(1);
        if (texto.indexOf('\0') >= 0) throw erro(HttpStatus.BAD_REQUEST, "CSV contém caractere inválido.");
        List<List<String>> registros = registrosCsv(texto);
        if (registros.isEmpty()) throw erro(HttpStatus.BAD_REQUEST, "CSV sem cabeçalho.");
        int[] colunas = cabecalho(registros.get(0));
        List<Linha> linhas = new ArrayList<>();
        for (int i = 1; i < registros.size(); i++) {
            List<String> r = registros.get(i);
            if (r.stream().allMatch(String::isBlank)) continue;
            if (r.size() > 3 && r.subList(3, r.size()).stream().anyMatch(v -> !v.isBlank())) throw erro(HttpStatus.BAD_REQUEST, "CSV contém conteúdo fora das três colunas do modelo.");
            if (linhas.size() == MAX_LINHAS) throw erro(HttpStatus.PAYLOAD_TOO_LARGE, "A planilha excede 200 linhas de dados.");
            linhas.add(linha(i + 1, valor(r, colunas[0]), valor(r, colunas[1]), valor(r, colunas[2]), false));
        }
        if (linhas.isEmpty()) throw erro(HttpStatus.BAD_REQUEST, "CSV não contém linhas de produtos.");
        return new Planilha(duplicadas(linhas));
    }

    private List<List<String>> registrosCsv(String s) {
        List<List<String>> linhas = new ArrayList<>(); List<String> campos = new ArrayList<>(); StringBuilder campo = new StringBuilder();
        boolean aspas = false, fechouAspas = false;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (aspas) {
                if (c == '"') { if (i + 1 < s.length() && s.charAt(i + 1) == '"') { campo.append('"'); i++; } else { aspas = false; fechouAspas = true; } }
                else campo.append(c);
            } else if (c == '"') {
                if (campo.length() != 0 || fechouAspas) throw erro(HttpStatus.BAD_REQUEST, "CSV possui aspas fora de posição.");
                aspas = true;
            } else if (c == ';') {
                if (campos.size() >= 2) throw erro(HttpStatus.BAD_REQUEST, "CSV deve conter somente Código, Produto e Quantidade.");
                campos.add(campo.toString()); campo.setLength(0); fechouAspas = false;
            }
            else if (c == '\r' || c == '\n') {
                if (c == '\r' && i + 1 < s.length() && s.charAt(i + 1) == '\n') i++;
                campos.add(campo.toString()); adicionarRegistro(linhas, campos); campos.clear(); campo.setLength(0); fechouAspas = false;
            } else {
                if (fechouAspas) throw erro(HttpStatus.BAD_REQUEST, "CSV contém conteúdo após o fechamento das aspas.");
                campo.append(c);
            }
        }
        if (aspas) throw erro(HttpStatus.BAD_REQUEST, "CSV possui campo entre aspas sem fechamento.");
        if (campo.length() > 0 || !campos.isEmpty()) { campos.add(campo.toString()); adicionarRegistro(linhas, campos); }
        return linhas;
    }

    private void adicionarRegistro(List<List<String>> linhas, List<String> campos) {
        if (campos.stream().allMatch(String::isBlank)) return;
        if (linhas.size() >= MAX_LINHAS + 1) throw erro(HttpStatus.PAYLOAD_TOO_LARGE, "A planilha excede 200 linhas de dados.");
        linhas.add(List.copyOf(campos));
    }

    private Planilha xlsx(byte[] bytes) {
        Map<String, byte[]> entradas = zip(bytes);
        for (String nome : entradas.keySet()) {
            String n = nome.toLowerCase(Locale.ROOT);
            if (n.contains("vbaproject") || n.contains("externallinks") || n.endsWith("/externallink.xml"))
                throw erro(HttpStatus.BAD_REQUEST, "XLSX com macros ou vínculos externos não é aceito.");
            if (n.endsWith(".rels")) {
                NodeList rels = xml(entradas.get(nome)).getElementsByTagNameNS("http://schemas.openxmlformats.org/package/2006/relationships", "Relationship");
                for (int i = 0; i < rels.getLength(); i++) if ("External".equalsIgnoreCase(((Element) rels.item(i)).getAttribute("TargetMode")))
                    throw erro(HttpStatus.BAD_REQUEST, "XLSX com relacionamentos externos não é aceito.");
            }
        }
        byte[] wb = entradas.get("xl/workbook.xml"), rels = entradas.get("xl/_rels/workbook.xml.rels");
        if (wb == null || rels == null) throw erro(HttpStatus.BAD_REQUEST, "XLSX inválido ou sem a primeira planilha.");
        Document workbook = xml(wb);
        NodeList sheets = workbook.getElementsByTagNameNS(MAIN, "sheet");
        if (sheets.getLength() != 1) throw erro(HttpStatus.BAD_REQUEST, "XLSX deve conter exatamente uma planilha.");
        String sheetId = ((Element) sheets.item(0)).getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
        String sheetPath = caminhoPlanilha(xml(rels), sheetId);
        for (String nome : entradas.keySet()) if (nome.startsWith("xl/worksheets/") && nome.endsWith(".xml") && !nome.equals(sheetPath))
            throw erro(HttpStatus.BAD_REQUEST, "XLSX deve conter somente uma planilha.");
        byte[] contentTypes = entradas.get("[Content_Types].xml");
        if (contentTypes != null && new String(contentTypes, StandardCharsets.UTF_8).toLowerCase(Locale.ROOT).contains("macroenabled"))
            throw erro(HttpStatus.BAD_REQUEST, "XLSX com macros não é aceito.");
        byte[] sheet = entradas.get(sheetPath);
        if (sheet == null) throw erro(HttpStatus.BAD_REQUEST, "XLSX inválido ou sem a primeira planilha.");
        Map<Integer, String> strings = sharedStrings(entradas.get("xl/sharedStrings.xml"));
        Document doc = xml(sheet);
        NodeList rows = doc.getElementsByTagNameNS(MAIN, "row");
        if (rows.getLength() == 0) throw erro(HttpStatus.BAD_REQUEST, "XLSX sem cabeçalho.");
        if (rows.getLength() > MAX_LINHAS + 1) throw erro(HttpStatus.PAYLOAD_TOO_LARGE, "A planilha excede 200 linhas de dados.");
        List<String> cab = new ArrayList<>(); Map<Integer, String> primeiro = celulas((Element) rows.item(0), strings, true);
        for (int i = 0; i < 3; i++) cab.add(primeiro.getOrDefault(i, ""));
        int[] colunas = cabecalho(cab);
        List<Linha> linhas = new ArrayList<>();
        for (int i = 1; i < rows.getLength(); i++) {
            Element row = (Element) rows.item(i); Map<Integer, String> c = celulas(row, strings, false);
            if (c.values().stream().allMatch(String::isBlank)) continue;
            if (linhas.size() == MAX_LINHAS) throw erro(HttpStatus.PAYLOAD_TOO_LARGE, "A planilha excede 200 linhas de dados.");
            int numero = row.hasAttribute("r") ? parseRow(row.getAttribute("r"), i + 1) : i + 1;
            linhas.add(linha(numero, c.get(colunas[0]), c.get(colunas[1]), c.get(colunas[2]), true));
        }
        if (linhas.isEmpty()) throw erro(HttpStatus.BAD_REQUEST, "XLSX não contém linhas de produtos.");
        return new Planilha(duplicadas(linhas));
    }

    private Map<Integer, String> celulas(Element row, Map<Integer, String> shared, boolean header) {
        Map<Integer, String> out = new HashMap<>(); NodeList cells = row.getElementsByTagNameNS(MAIN, "c");
        for (int i = 0; i < cells.getLength(); i++) {
            Element cell = (Element) cells.item(i); int col = coluna(cell.getAttribute("r"));
            if (col > 2) {
                String v = textoCelula(cell, shared, false);
                if (!v.isBlank()) throw erro(HttpStatus.BAD_REQUEST, "XLSX contém conteúdo fora das três colunas do modelo.");
                continue;
            }
            String type = cell.getAttribute("t");
            if (!header && col == 0 && !(type.equals("s") || type.equals("inlineStr") || (type.isEmpty() && cell.getElementsByTagNameNS(MAIN, "v").getLength() == 0)))
                throw erro(HttpStatus.BAD_REQUEST, "Código deve estar armazenado como texto para preservar zeros à esquerda.");
            if (out.putIfAbsent(col, textoCelula(cell, shared, header)) != null) throw erro(HttpStatus.BAD_REQUEST, "XLSX contém referência de célula duplicada.");
        }
        return out;
    }

    private String textoCelula(Element cell, Map<Integer, String> shared, boolean header) {
        if (cell.getElementsByTagNameNS(MAIN, "f").getLength() > 0) throw erro(HttpStatus.BAD_REQUEST, "Fórmulas não são aceitas na planilha.");
        String type = cell.getAttribute("t");
        if (type.equals("e") || type.equals("b")) throw erro(HttpStatus.BAD_REQUEST, "XLSX contém célula de erro ou valor booleano inesperado.");
        if (type.equals("inlineStr")) return texto(cell.getElementsByTagNameNS(MAIN, "t"));
        String v = texto(cell.getElementsByTagNameNS(MAIN, "v"));
        if (type.equals("s")) {
            try { String valor = shared.get(Integer.parseInt(v)); if (valor == null) throw new NumberFormatException(); return valor; }
            catch (NumberFormatException e) { throw erro(HttpStatus.BAD_REQUEST, "XLSX contém referência inválida a texto compartilhado."); }
        }
        if (type.isEmpty() || type.equals("n")) return v;
        if (header || type.equals("str")) return v;
        throw erro(HttpStatus.BAD_REQUEST, "XLSX contém tipo de célula não suportado.");
    }

    private Map<Integer, String> sharedStrings(byte[] bytes) {
        Map<Integer, String> out = new HashMap<>(); if (bytes == null) return out;
        NodeList items = xml(bytes).getElementsByTagNameNS(MAIN, "si");
        if (items.getLength() > 10000) throw erro(HttpStatus.PAYLOAD_TOO_LARGE, "XLSX contém texto compartilhado em excesso.");
        for (int i = 0; i < items.getLength(); i++) out.put(i, texto(((Element) items.item(i)).getElementsByTagNameNS(MAIN, "t")));
        return out;
    }

    private Document xml(byte[] bytes) {
        if (bytes.length > 2 * 1024 * 1024) throw erro(HttpStatus.PAYLOAD_TOO_LARGE, "Uma estrutura XLSX excede o limite de leitura.");
        try {
            DocumentBuilderFactory f = DocumentBuilderFactory.newInstance(); f.setNamespaceAware(true);
            f.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            f.setFeature("http://xml.org/sax/features/external-general-entities", false);
            f.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            f.setXIncludeAware(false); f.setExpandEntityReferences(false);
            var builder = f.newDocumentBuilder(); builder.setEntityResolver((publicId, systemId) -> new InputSource(new StringReader("")));
            return builder.parse(new ByteArrayInputStream(bytes));
        } catch (Exception e) { throw erro(HttpStatus.BAD_REQUEST, "XLSX corrompido ou com XML inválido."); }
    }

    private Map<String, byte[]> zip(byte[] bytes) {
        Map<String, byte[]> out = new LinkedHashMap<>(); int total = 0;
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(bytes), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = in.getNextEntry()) != null) {
                String name = entry.getName();
                if (name.startsWith("/") || name.contains("..") || name.contains("\\") || name.length() > 240)
                    throw erro(HttpStatus.BAD_REQUEST, "XLSX contém caminho inválido.");
                if (entry.isDirectory()) continue;
                if (out.size() >= MAX_ENTRADAS_ZIP || out.containsKey(name)) throw erro(HttpStatus.BAD_REQUEST, "XLSX contém entradas ZIP excessivas ou duplicadas.");
                ByteArrayOutputStream data = new ByteArrayOutputStream(); byte[] buffer = new byte[8192]; int n;
                while ((n = in.read(buffer)) != -1) {
                    total += n;
                    if (total > MAX_XML_EXPANDIDO) throw erro(HttpStatus.PAYLOAD_TOO_LARGE, "XLSX descompactado excede 8 MiB.");
                    data.write(buffer, 0, n);
                }
                out.put(name, data.toByteArray());
            }
        } catch (ResponseStatusException e) { throw e; }
        catch (Exception e) { throw erro(HttpStatus.BAD_REQUEST, "XLSX corrompido ou ZIP inválido."); }
        if (out.isEmpty()) throw erro(HttpStatus.BAD_REQUEST, "XLSX sem conteúdo.");
        return out;
    }

    private int[] cabecalho(List<String> c) {
        if (c.size() > 3 && c.subList(3, c.size()).stream().anyMatch(v -> !v.isBlank()))
            throw erro(HttpStatus.BAD_REQUEST, "CSV/XLSX deve conter somente Código, Produto e Quantidade.");
        Map<String, Integer> mapa = new HashMap<>();
        for (int i = 0; i < c.size(); i++) { String k = normalizar(c.get(i)); if (!k.isBlank() && mapa.putIfAbsent(k, i) != null) throw erro(HttpStatus.BAD_REQUEST, "Cabeçalho possui colunas duplicadas."); }
        if (!mapa.containsKey("codigo") || !mapa.containsKey("produto") || !mapa.containsKey("quantidade"))
            throw erro(HttpStatus.BAD_REQUEST, "Cabeçalho obrigatório: Código;Produto;Quantidade.");
        return new int[]{mapa.get("codigo"), mapa.get("produto"), mapa.get("quantidade")};
    }

    private Linha linha(int n, String codigo, String descricao, String qtd, boolean xlsx) {
        String cod = codigo == null ? "" : codigo.trim(), desc = descricao == null ? "" : descricao.trim(), raw = qtd == null ? "" : qtd.trim();
        List<String> erros = new ArrayList<>(); BigDecimal quantidade = null;
        if (cod.isEmpty()) erros.add("Código obrigatório.");
        if (cod.length() > 60) erros.add("Código excede 60 caracteres.");
        if (desc.length() > 200) erros.add("Descrição excede 200 caracteres.");
        if (raw.isEmpty()) erros.add("Quantidade obrigatória.");
        else {
            String numero = xlsx ? raw : raw.replace(',', '.');
            if (raw.length() > 40 || !(xlsx ? numero.matches("[0-9]+(?:\\.[0-9]+)?") : raw.matches("[0-9]+(?:,[0-9]+)?"))) erros.add("Quantidade inválida; use decimal pt-BR no CSV ou valor numérico XLSX, sem separador de milhar.");
            else try {
                quantidade = new BigDecimal(numero);
                if (quantidade.stripTrailingZeros().scale() > 3) erros.add("Quantidade excede a precisão de três casas decimais.");
                if (quantidade.compareTo(new BigDecimal("9999999999999999.999")) > 0) erros.add("Quantidade excede o limite permitido.");
            }
            catch (NumberFormatException e) { erros.add("Quantidade inválida."); }
        }
        return new Linha(n, cod, desc, quantidade, erros);
    }

    private List<Linha> duplicadas(List<Linha> rows) {
        Map<String, Integer> counts = new HashMap<>(); rows.stream().filter(l -> !l.codigo().isBlank()).forEach(l -> counts.merge(l.codigo(), 1, Integer::sum));
        return rows.stream().map(l -> {
            if (counts.getOrDefault(l.codigo(), 0) <= 1) return l;
            List<String> erros = new ArrayList<>(l.erros()); erros.add("Código duplicado no arquivo.");
            return new Linha(l.numero(), l.codigo(), l.descricao(), l.quantidade(), List.copyOf(erros));
        }).toList();
    }

    private int coluna(String ref) {
        int n = 0, i = 0; while (i < ref.length() && Character.isLetter(ref.charAt(i))) n = n * 26 + Character.toUpperCase(ref.charAt(i++)) - 'A' + 1;
        if (i == 0 || n > 1000) throw erro(HttpStatus.BAD_REQUEST, "XLSX contém referência de célula inválida.");
        return n - 1;
    }
    private String caminhoPlanilha(Document rels, String sheetId) {
        if (sheetId.isBlank()) throw erro(HttpStatus.BAD_REQUEST, "XLSX sem relacionamento válido da planilha.");
        NodeList nodes = rels.getElementsByTagNameNS("http://schemas.openxmlformats.org/package/2006/relationships", "Relationship");
        for (int i = 0; i < nodes.getLength(); i++) {
            Element e = (Element) nodes.item(i);
            if (!sheetId.equals(e.getAttribute("Id"))) continue;
            String target = e.getAttribute("Target").replace('\\', '/');
            if (target.startsWith("/") || target.contains(":") || target.contains("..")) throw erro(HttpStatus.BAD_REQUEST, "XLSX contém caminho de planilha inválido.");
            String path = target.startsWith("xl/") ? target : "xl/" + target;
            if (!path.startsWith("xl/worksheets/") || !path.endsWith(".xml")) throw erro(HttpStatus.BAD_REQUEST, "XLSX contém destino de planilha inválido.");
            return path;
        }
        throw erro(HttpStatus.BAD_REQUEST, "XLSX sem relacionamento válido da planilha.");
    }
    private int parseRow(String ref, int fallback) { try { int n = Integer.parseInt(ref); return n > 0 ? n : fallback; } catch (NumberFormatException e) { return fallback; } }
    private String texto(NodeList nodes) { StringBuilder s = new StringBuilder(); for (int i = 0; i < nodes.getLength(); i++) s.append(nodes.item(i).getTextContent()); return s.toString(); }
    private String valor(List<String> r, int i) { return i < r.size() ? r.get(i) : ""; }
    private String normalizar(String s) { return Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "").trim().toLowerCase(Locale.ROOT); }
    private boolean isZip(byte[] b) { return b.length >= 4 && b[0] == 'P' && b[1] == 'K' && (b[2] == 3 || b[2] == 5 || b[2] == 7) && (b[3] == 4 || b[3] == 6 || b[3] == 8); }
    private ResponseStatusException erro(HttpStatus status, String mensagem) { return new ResponseStatusException(status, mensagem); }
}
