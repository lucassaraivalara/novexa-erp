package br.com.novexa.erp.service;

import org.apache.poi.hssf.eventusermodel.*;
import org.apache.poi.hssf.record.*;
import org.apache.poi.poifs.filesystem.POIFSFileSystem;
import java.io.*;
import java.util.*;
import static br.com.novexa.erp.service.ProdutoPlanilhaReader.*;

/** Event reader accepts exports that omit optional Excel window metadata. No repair or formula evaluation. */
final class ProdutoXlsReader implements HSSFListener {
    private SSTRecord strings;
    private final FormatTrackingHSSFListener formatos=new FormatTrackingHSSFListener(this,Locale.forLanguageTag("pt-BR"));
    private final TreeMap<Integer,TreeMap<Integer,String>> dados=new TreeMap<>();
    private final Map<Integer,List<String>> erros=new HashMap<>();
    private int abas=0; private boolean planilha=false;
    static List<LinhaBruta> ler(byte[] bytes) throws IOException {
        var leitor=new ProdutoXlsReader();
        try(var fs=new POIFSFileSystem(new ByteArrayInputStream(bytes))) {
            var request=new HSSFRequest();request.addListenerForAllRecords(leitor.formatos);
            new HSSFEventFactory().processWorkbookEvents(request,fs);
        }
        if(leitor.abas!=1) throw invalido("Envie um arquivo com uma única aba de produtos.");
        var linhas=new ArrayList<LinhaBruta>();
        for(int r=0;r<=(leitor.dados.isEmpty()?0:leitor.dados.lastKey());r++) {
            var celulas=leitor.dados.getOrDefault(r,new TreeMap<>()); var valores=new ArrayList<String>();
            for(int c=0;c<=(celulas.isEmpty()?-1:celulas.lastKey());c++) valores.add(celulas.getOrDefault(c,""));
            linhas.add(new LinhaBruta(r+1,valores,leitor.erros.getOrDefault(r,List.of())));
        }
        return linhas;
    }
    @Override public void processRecord(org.apache.poi.hssf.record.Record record) {
        if(record instanceof SSTRecord s) strings=s;
        if(record instanceof BOFRecord b) { planilha=b.getType()==BOFRecord.TYPE_WORKSHEET; if(planilha && ++abas>1) throw invalido("Envie uma única aba de produtos."); }
        if(!planilha) return;
        if(record instanceof LabelSSTRecord r) celula(r.getRow(),r.getColumn(),strings.getString(r.getSSTIndex()).getString());
        else if(record instanceof LabelRecord r) celula(r.getRow(),r.getColumn(),r.getValue());
        else if(record instanceof NumberRecord r) numero(r.getRow(),r.getColumn(),r.getXFIndex(),r.getValue());
        else if(record instanceof RKRecord r) numero(r.getRow(),r.getColumn(),r.getXFIndex(),r.getRKNumber());
        else if(record instanceof MulRKRecord r) for(int i=0;i<r.getNumColumns();i++) numero(r.getRow(),r.getFirstColumn()+i,r.getXFAt(i),r.getRKNumberAt(i));
        else if(record instanceof FormulaRecord r) { celula(r.getRow(),r.getColumn(),""); erro(r.getRow(),"Coluna "+(r.getColumn()+1)+": use um valor, sem fórmula."); }
        else if(record instanceof BoolErrRecord r) { celula(r.getRow(),r.getColumn(),r.isBoolean()?Boolean.toString(r.getBooleanValue()):""); if(!r.isBoolean()) erro(r.getRow(),"Coluna "+(r.getColumn()+1)+": erro de célula."); }
    }
    private void celula(int r,int c,String valor) {
        if(r>MAX_LINHAS+20 || c>=MAX_COLUNAS || valor.length()>2000) throw invalido("XLS excede os limites de linhas, colunas ou tamanho da célula.");
        dados.computeIfAbsent(r,k->new TreeMap<>()).put(c,valor.trim());
    }
    private void numero(int row,int col,short xf,double valor) {
        var number=new NumberRecord(); number.setRow(row);number.setColumn((short)col);number.setXFIndex(xf);number.setValue(valor);
        String texto=formatos.formatNumberDateCell(number);
        boolean identificador=dados.entrySet().stream().filter(e->e.getKey()<20 && e.getKey()<row)
            .anyMatch(e->Set.of("codigo","ean","gtin","eangtin","ncm","cest").contains(normalizar(e.getValue().getOrDefault(col,""))));
        if(identificador) {
            String exato=java.math.BigDecimal.valueOf(valor).stripTrailingZeros().toPlainString();
            if(!texto.matches("[0-9. -]+")) texto=exato;
            if(exato.replace("-","").replace(".","").length()>15) erro(row,"Coluna "+(col+1)+": identificador numérico excede precisão do Excel. Use texto.");
        }
        celula(row,col,texto);
    }
    private void erro(int r,String mensagem) { erros.computeIfAbsent(r,k->new ArrayList<>()).add(mensagem); }
}
