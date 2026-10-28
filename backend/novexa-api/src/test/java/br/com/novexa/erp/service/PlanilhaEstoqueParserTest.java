package br.com.novexa.erp.service;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import static org.assertj.core.api.Assertions.*;

class PlanilhaEstoqueParserTest {
    private final PlanilhaEstoqueParser parser = new PlanilhaEstoqueParser();
    private static final String CODIGO = "C\u00f3digo";
    private static final String HEADER = "<c r=\"A1\" t=\"inlineStr\"><is><t>C\u00f3digo</t></is></c><c r=\"B1\" t=\"inlineStr\"><is><t>Produto</t></is></c><c r=\"C1\" t=\"inlineStr\"><is><t>Quantidade</t></is></c>";

    @Test void csvUtf8BomSemicolonPreservaCodigoEdecimalPtBr() {
        var result = parser.parse("inventario.csv", ("\ufeff" + CODIGO + ";Produto;Quantidade\r\n001;Coca-Cola 2L;14,5\r\n").getBytes(StandardCharsets.UTF_8));
        assertThat(result.linhas()).singleElement().satisfies(l -> {
            assertThat(l.codigo()).isEqualTo("001"); assertThat(l.descricao()).isEqualTo("Coca-Cola 2L");
            assertThat(l.quantidade()).hasToString("14.5"); assertThat(l.erros()).isEmpty();
        });
    }

    @Test void csvIdentificaCodigoDuplicadoQuantidadeComMilharEQuantidadeVazia() {
        var result = parser.parse("inventario.csv", (CODIGO + ";Produto;Quantidade\n001;Produto;1\n001;Outro;1.000,25\n002;;\n").getBytes(StandardCharsets.UTF_8));
        assertThat(result.linhas()).hasSize(3);
        assertThat(result.linhas().get(0).erros()).anyMatch(e -> e.contains("duplicado"));
        assertThat(result.linhas().get(1).erros()).anyMatch(e -> e.contains("Quantidade inv\u00e1lida"));
        assertThat(result.linhas().get(2).erros()).anyMatch(e -> e.contains("Quantidade obrigat\u00f3ria"));
    }

    @Test void csvAceitaZeroFinalDePrecisaoERejeitaFracaoRealmenteExcessiva() {
        var result = parser.parse("inventario.csv", (CODIGO + ";Produto;Quantidade\n001;Produto;14,5000\n002;Produto;14,5001\n003;Produto;-1\n").getBytes(StandardCharsets.UTF_8));
        assertThat(result.linhas().get(0).quantidade()).hasToString("14.5000"); assertThat(result.linhas().get(0).erros()).isEmpty();
        assertThat(result.linhas().get(1).erros()).anyMatch(e -> e.contains("precis\u00e3o"));
        assertThat(result.linhas().get(2).erros()).anyMatch(e -> e.contains("inv\u00e1lida"));
    }

    @Test void xlsxLeTextoPreservaZerosERejeitaFormula() {
        String dados = "<c r=\"A2\" t=\"inlineStr\"><is><t>001</t></is></c><c r=\"B2\" t=\"inlineStr\"><is><t>\u00c1gua</t></is></c><c r=\"C2\"><v>14.5</v></c>";
        var result = parser.parse("contagem.xlsx", xlsx(dados));
        assertThat(result.linhas()).singleElement().satisfies(l -> { assertThat(l.codigo()).isEqualTo("001"); assertThat(l.quantidade()).hasToString("14.5"); });
        assertThatThrownBy(() -> parser.parse("contagem.xlsx", xlsx("<c r=\"A2\" t=\"inlineStr\"><is><t>001</t></is></c><c r=\"C2\"><f>SUM(1,2)</f><v>3</v></c>")))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test void rejeitaFormatoIncompativelCorrompidoMacroERelacaoExterna() {
        assertThatThrownBy(() -> parser.parse("a.xlsx", "nao e zip".getBytes(StandardCharsets.UTF_8))).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> parser.parse("a.csv", xlsx(""))).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> parser.parse("a.xlsx", xlsxCom("xl/vbaProject.bin", new byte[]{1}))).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> parser.parse("a.xlsx", xlsxCom("xl/worksheets/_rels/sheet1.xml.rels",
                "<Relationships TargetMode=\"External\"/>".getBytes(StandardCharsets.UTF_8)))).isInstanceOf(ResponseStatusException.class);
    }

    @Test void validaExtensaoLimiteELinhas() {
        assertThatThrownBy(() -> parser.parse("x.txt", new byte[]{1})).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> parser.parse("x.csv", (CODIGO + ";Quantidade\n001;1").getBytes(StandardCharsets.UTF_8))).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> parser.parse("x.csv", new byte[PlanilhaEstoqueParser.MAX_BYTES + 1])).isInstanceOf(ResponseStatusException.class);
        StringBuilder csv = new StringBuilder(CODIGO + ";Produto;Quantidade\n");
        for (int i = 0; i < 201; i++) csv.append(i).append(";p;1\n");
        assertThatThrownBy(() -> parser.parse("x.csv", csv.toString().getBytes(StandardCharsets.UTF_8))).isInstanceOf(ResponseStatusException.class);
    }

    private byte[] xlsx(String data) {
        String xml = "<?xml version=\"1.0\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData><row r=\"1\">" + HEADER + "</row><row r=\"2\">" + data + "</row></sheetData></worksheet>";
        return xlsxCom("xl/worksheets/sheet1.xml", xml.getBytes(StandardCharsets.UTF_8));
    }
    private byte[] xlsxCom(String extraPath, byte[] extra) {
        try {
            var out = new ByteArrayOutputStream(); var zip = new ZipOutputStream(out);
            entry(zip, "xl/workbook.xml", "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheets><sheet name=\"Dados\" sheetId=\"1\" r:id=\"rId1\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"/></sheets></workbook>".getBytes(StandardCharsets.UTF_8));
            entry(zip, "xl/_rels/workbook.xml.rels", "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Target=\"worksheets/sheet1.xml\"/></Relationships>".getBytes(StandardCharsets.UTF_8));
            if (!extraPath.equals("xl/worksheets/sheet1.xml")) entry(zip, "xl/worksheets/sheet1.xml", "<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData/></worksheet>".getBytes(StandardCharsets.UTF_8));
            entry(zip, extraPath, extra); zip.close(); return out.toByteArray();
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
    private void entry(ZipOutputStream zip, String name, byte[] bytes) throws Exception { zip.putNextEntry(new ZipEntry(name)); zip.write(bytes); zip.closeEntry(); }
}
