package br.com.novexa.erp.service;

import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.io.*;
import java.nio.ByteBuffer;
import java.nio.charset.*;
import java.text.Normalizer;
import java.util.*;
import java.util.zip.ZipInputStream;

@Component
public class ProdutoPlanilhaReader {
    public static final int MAX_BYTES=2*1024*1024, MAX_LINHAS=2000, MAX_COLUNAS=64;
    public record LinhaBruta(int numero, List<String> valores, List<String> erros) {}
    public record Planilha(List<String> cabecalho, List<LinhaBruta> linhas) {}
    public Planilha ler(MultipartFile arquivo) {
        if (arquivo==null || arquivo.isEmpty()) throw invalido("Selecione um arquivo XLS, XLSX ou CSV.");
        if (arquivo.getSize()>MAX_BYTES) throw invalido("O arquivo deve ter no máximo 2 MB.");
        String nome=Optional.ofNullable(arquivo.getOriginalFilename()).orElse("").toLowerCase(Locale.ROOT);
        try {
            byte[] bytes;
            try (var in=arquivo.getInputStream()) { bytes=in.readNBytes(MAX_BYTES+1); }
            if(bytes.length>MAX_BYTES) throw invalido("O arquivo deve ter no máximo 2 MB.");
            List<LinhaBruta> linhas;
            if(nome.endsWith(".csv")) linhas=csv(bytes);
            else if(nome.endsWith(".xls") || nome.endsWith(".xlsx")) {
                if(nome.endsWith(".xlsx")) conferirZip(bytes);
                try { linhas=excel(bytes); }
                catch(IllegalArgumentException e) {
                    if(nome.endsWith(".xls") && e.getMessage()!=null && e.getMessage().contains("WindowTwoRecord")) linhas=ProdutoXlsReader.ler(bytes);
                    else throw e;
                }
            } else throw invalido("Formato não suportado. Use XLS, XLSX ou CSV.");
            int header=-1;
            for(int i=0;i<Math.min(20,linhas.size());i++) {
                var campos=linhas.get(i).valores().stream().map(ProdutoPlanilhaReader::normalizar).toList();
                if(campos.contains("nome") && campos.contains("preco")) { header=i; break; }
            }
            if(header<0) throw invalido("Cabeçalho não encontrado. Informe Nome, Preço e Unidade.");
            var cabecalho=linhas.get(header).valores();
            if(!linhas.get(header).erros().isEmpty()) throw invalido("Cabeçalho inválido.");
            var dados=linhas.subList(header+1,linhas.size());
            if(dados.size()>MAX_LINHAS) throw invalido("A planilha deve ter no máximo 2.000 linhas de dados.");
            if(dados.isEmpty()) throw invalido("A planilha não possui linhas de dados.");
            return new Planilha(cabecalho,List.copyOf(dados));
        } catch(ResponseStatusException e) { throw e; }
        catch(Exception e) { throw invalido("Não foi possível ler o arquivo. Verifique o formato, a integridade e a ausência de senha."); }
    }
    private List<LinhaBruta> excel(byte[] bytes) throws IOException {
        try(var wb=WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
            if(wb.getNumberOfSheets()!=1) throw invalido("Envie um arquivo com uma única aba de produtos.");
            var sheet=wb.getSheetAt(0);
            if(sheet.getLastRowNum()>MAX_LINHAS+20) throw invalido("A planilha excede o limite de linhas.");
            var format=new DataFormatter(Locale.forLanguageTag("pt-BR"));
            var linhas=new ArrayList<LinhaBruta>(); var identidades=new HashSet<Integer>();
            for(int n=0;n<=sheet.getLastRowNum();n++) {
                var row=sheet.getRow(n); var valores=new ArrayList<String>(); var erros=new ArrayList<String>();
                int cols=row==null?0:Math.max(0,row.getLastCellNum());
                if(cols>MAX_COLUNAS) throw invalido("A planilha deve ter no máximo 64 colunas.");
                for(int c=0;c<cols;c++) {
                    var cell=row.getCell(c); String valor=cell==null?"":format.formatCellValue(cell);
                    if(cell!=null && cell.getCellType()==CellType.NUMERIC && identidades.contains(c)) {
                        double numero=cell.getNumericCellValue();
                        String exato=java.math.BigDecimal.valueOf(numero).stripTrailingZeros().toPlainString();
                        if(!valor.matches("[0-9. -]+")) valor=exato;
                        if(exato.replace("-", "").replace(".", "").length()>15)
                            erros.add("Coluna "+(c+1)+": identificador numérico excede a precisão do Excel. Use texto.");
                    }
                    if(cell!=null && (cell.getCellType()==CellType.FORMULA || cell.getCellType()==CellType.ERROR))
                        erros.add("Coluna "+(c+1)+": use um valor, sem fórmula ou erro de célula.");
                    if(valor.length()>2000) throw invalido("Uma célula excede o limite de 2.000 caracteres.");
                    valores.add(valor.trim());
                }
                if(valores.stream().map(ProdutoPlanilhaReader::normalizar).toList().containsAll(List.of("nome","preco")))
                    for(int c=0;c<valores.size();c++) if(Set.of("codigo","eangtin","ean","gtin","ncm","cest").contains(normalizar(valores.get(c)))) identidades.add(c);
                linhas.add(new LinhaBruta(n+1,valores,erros));
            }
            return linhas;
        }
    }
    private void conferirZip(byte[] bytes) throws IOException {
        long total=0; int entradas=0;
        try(var zip=new ZipInputStream(new ByteArrayInputStream(bytes))) {
            while(zip.getNextEntry()!=null) {
                if(++entradas>256) throw invalido("Arquivo XLSX excede os limites de processamento.");
                int n; byte[] buffer=new byte[8192];
                while((n=zip.read(buffer))!=-1) { total+=n; if(total>20L*1024*1024) throw invalido("Arquivo XLSX excede o tamanho descompactado permitido."); }
            }
        }
        if(entradas==0) throw invalido("Arquivo XLSX inválido.");
    }
    private List<LinhaBruta> csv(byte[] bytes) throws CharacterCodingException {
        String texto;
        try { texto=StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes)).toString(); }
        catch(CharacterCodingException e) { texto=Charset.forName("windows-1252").decode(ByteBuffer.wrap(bytes)).toString(); }
        texto=texto.replaceFirst("^\uFEFF", "");
        String primeira=texto.lines().filter(l->!l.isBlank()).findFirst().orElse("");
        char separador=primeira.chars().filter(c->c==';').count()>primeira.chars().filter(c->c==',').count()?';':',';
        if(primeira.indexOf('\t')>=0 && primeira.indexOf(';')<0 && primeira.indexOf(',')<0) separador='\t';
        var linhas=new ArrayList<LinhaBruta>(); var celulas=new ArrayList<String>(); var valor=new StringBuilder();
        boolean aspas=false, fechou=false; int linha=1, inicio=1;
        for(int i=0;i<=texto.length();i++) {
            char c=i==texto.length()?'\n':texto.charAt(i);
            if(c=='"') {
                if(aspas && i+1<texto.length() && texto.charAt(i+1)=='"') { valor.append('"'); i++; }
                else if(aspas) { aspas=false; fechou=true; }
                else if(valor.isEmpty() && !fechou) aspas=true;
                else throw invalido("Aspas inválidas no CSV, linha "+linha+".");
            } else if(!aspas && (c==separador || c=='\n' || c=='\r')) {
                celulas.add(valor.toString().trim()); valor.setLength(0); fechou=false;
                if(celulas.size()>MAX_COLUNAS) throw invalido("O CSV deve ter no máximo 64 colunas.");
                if(c!=separador) {
                    if(c=='\r' && i+1<texto.length() && texto.charAt(i+1)=='\n') i++;
                    // Do not manufacture an extra row at EOF after a line terminator.
                    if(i<texto.length() || !celulas.stream().allMatch(String::isBlank)) linhas.add(new LinhaBruta(inicio,List.copyOf(celulas),List.of()));
                    celulas.clear(); linha++; inicio=linha;
                    if(linhas.size()>MAX_LINHAS+20) throw invalido("O CSV excede o limite de linhas.");
                }
            } else {
                if(fechou && !Character.isWhitespace(c)) throw invalido("CSV inválido na linha "+linha+".");
                valor.append(c); if(c=='\n') linha++;
                if(valor.length()>2000) throw invalido("Uma célula excede o limite de 2.000 caracteres.");
            }
        }
        if(aspas) throw invalido("O CSV possui aspas sem fechamento.");
        return linhas;
    }
    public static String normalizar(String s) {
        return Normalizer.normalize(s.trim(),Normalizer.Form.NFD).replaceAll("\\p{M}","").toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }
    static ResponseStatusException invalido(String mensagem) { return new ResponseStatusException(HttpStatus.BAD_REQUEST,mensagem); }
}
