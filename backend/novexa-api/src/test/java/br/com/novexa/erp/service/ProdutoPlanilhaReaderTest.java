package br.com.novexa.erp.service;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.mock.web.MockMultipartFile;
import java.io.*;
import java.nio.file.*;
import java.nio.charset.*;
import static org.assertj.core.api.Assertions.*;

class ProdutoPlanilhaReaderTest {
    final ProdutoPlanilhaReader reader=new ProdutoPlanilhaReader();
    @Test void xlsEXlsxPreservamZerosEANEMarcamFormulaSemExecutar() throws Exception {
        for(Workbook wb:new Workbook[]{new HSSFWorkbook(),new XSSFWorkbook()}) try(wb; var out=new ByteArrayOutputStream()) {
            var s=wb.createSheet("Produtos"); var h=s.createRow(0); String[] nomes={"Nome","Preço","Unidade","Código","EAN / GTIN"};
            for(int i=0;i<nomes.length;i++) h.createCell(i).setCellValue(nomes[i]);
            var r=s.createRow(1); r.createCell(0).setCellValue("Café");r.createCell(1).setCellValue(12.5);r.createCell(2).setCellValue("UN");
            r.createCell(3).setCellValue("00001"); r.createCell(4).setCellValue(7891234567890d);
            s.createRow(2).createCell(0).setCellFormula("1+1"); wb.write(out);
            var p=reader.ler(new MockMultipartFile("arquivo",wb instanceof HSSFWorkbook?"a.xls":"a.xlsx","application/octet-stream",out.toByteArray()));
            assertThat(p.linhas().getFirst().valores().get(3)).isEqualTo("00001"); assertThat(p.linhas().getFirst().valores().get(4)).isEqualTo("7891234567890");
            assertThat(p.linhas().get(1).erros()).isNotEmpty();
        }
    }
    @Test void csvUtf8BomEWindows1252RespeitamAspasSeparadoresELinhas() {
        for(Charset charset:new Charset[]{StandardCharsets.UTF_8,Charset.forName("windows-1252")}) {
            var p=reader.ler(csv("Nome;Preço;Unidade\r\n\"Café; especial\";12,50;UN\r\n;;;\r\n",charset));
            assertThat(p.linhas().getFirst().valores().getFirst()).isEqualTo("Café; especial"); assertThat(p.linhas().getFirst().numero()).isEqualTo(2);
        }
        var p=reader.ler(csv("\uFEFFNome,Preço,Unidade\n\"Café\"\" especial\",12.50,UN",StandardCharsets.UTF_8));
        assertThat(p.linhas().getFirst().valores().getFirst()).isEqualTo("Café\" especial");
    }
    @Test void rejeitaFormatoTamanhoLinhaExcessivaECsvInvalido() {
        assertThatThrownBy(()->reader.ler(new MockMultipartFile("arquivo","a.txt","text/plain","Nome;Preço;Unidade".getBytes()))).hasMessageContaining("Formato");
        assertThatThrownBy(()->reader.ler(new MockMultipartFile("arquivo","a.xls","text/plain",new byte[ProdutoPlanilhaReader.MAX_BYTES+1]))).hasMessageContaining("2 MB");
        assertThatThrownBy(()->reader.ler(csv("Nome;Preço;Unidade\n\"sem fechar",StandardCharsets.UTF_8))).hasMessageContaining("aspas");
        assertThatThrownBy(()->reader.ler(csv("Nome;Preço;Unidade\n"+"A;1;UN\n".repeat(2001),StandardCharsets.UTF_8))).hasMessageContaining("2.000");
    }
    @Test @EnabledIfSystemProperty(named="novexa.test.planilha-exemplo",matches=".+")
    void arquivoAnexadoEReconhecidoSemImportarDados() throws Exception {
        var path=Path.of(System.getProperty("novexa.test.planilha-exemplo"));
        var p=reader.ler(new MockMultipartFile("arquivo",path.getFileName().toString(),"application/vnd.ms-excel",Files.readAllBytes(path)));
        assertThat(p.cabecalho()).isNotEmpty(); assertThat(p.linhas()).isNotEmpty();
        System.out.println("Planilha de referência: colunas="+p.cabecalho()+"; linhas="+p.linhas().size());
    }
    private MockMultipartFile csv(String texto,Charset charset) {return new MockMultipartFile("arquivo","a.csv","text/csv",texto.getBytes(charset));}
}
