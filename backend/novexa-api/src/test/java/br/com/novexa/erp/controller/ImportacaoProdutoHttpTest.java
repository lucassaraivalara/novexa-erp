package br.com.novexa.erp.controller;

import org.junit.jupiter.api.*;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import br.com.novexa.erp.entity.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ImportacaoProdutoHttpTest extends ProdutoClassificacaoHttpTest {
    static final String CAB="Nome;Código;EAN / GTIN;Preço;Unidade;Estoque Min.;Status;Categoria;Sub Categoria;Marca;Fornecedor Principal;NCM;CEST;Estoque Atual\n";
    String operador;
    @BeforeEach void administradores() {
        operador=tokenA; tokenA=admin(empresaA,"11144477735"); tokenB=admin(empresaB,"98765432100");
    }
    private String admin(EmpresaEntity empresa,String cpf) {
        var u=new UsuarioEntity(); u.setEmpresa(empresa); u.setNomeUsuario("Admin"); u.setCpf(cpf); u.setSenha("hash"); u.setAtivo(true); u.setPerfil(PerfilUsuario.ADMIN);
        return "Bearer "+jwt.gerarToken(usuarios.saveAndFlush(u));
    }
    String linha(String nome,String codigo,String ean,String extra) { return nome+";"+codigo+";"+ean+";12,50;UN;2,125;Ativo;Categoria A;Sub A;Marca A;Distribuidora A;09011110;1700100;"+extra+"\n"; }
    String previa(String csv) throws Exception {
        var r=mvc.perform(multipart("/produtos/importacoes").file(arquivo(csv)).header("Authorization",tokenA)).andExpect(status().isOk()).andReturn();
        return json.readTree(r.getResponse().getContentAsString()).get("id").asText();
    }
    MockMultipartFile arquivo(String csv) { return new MockMultipartFile("arquivo","produtos.csv","text/csv",csv.getBytes(StandardCharsets.UTF_8)); }
    @Test void previaNaoCriaProdutosConfirmaMetadadosVinculosESaldoZero() throws Exception {
        String id=previa(CAB+linha("Importado","IMPORT-001","7891234567890","999"));
        assertThat(produtos.count()).isZero();
        mvc.perform(get("/produtos/importacoes/"+id).header("Authorization",tokenA)).andExpect(status().isOk())
            .andExpect(jsonPath("$.validas").value(1)).andExpect(jsonPath("$.colunasIgnoradas[0]").value("Estoque Atual"));
        mvc.perform(post("/produtos/importacoes/"+id+"/confirmar").header("Authorization",tokenA)).andExpect(status().isOk())
            .andExpect(jsonPath("$.importados").value(1)).andExpect(jsonPath("$.estado").value("CONFIRMADA"));
        em.flush(); em.clear(); var p=produtos.findAllByEmpresaIdOrderByNomeAsc(empresaA.getId()).getFirst();
        assertThat(p.getCodigoInterno()).isEqualTo("IMPORT-001"); assertThat(p.getPrecoVenda()).isEqualByComparingTo("12.50");
        assertThat(p.getEstoqueAtual()).isEqualByComparingTo("0"); assertThat(p.getEstoqueMinimo()).isEqualByComparingTo("2.125");
        assertThat(p.getPrecoCusto()).isEqualByComparingTo("0"); assertThat(p.getNcm()).isEqualTo("09011110"); assertThat(p.getCest()).isEqualTo("1700100");
        assertThat(p.getCategoria().getId()).isEqualTo(categoriaA); assertThat(p.getSubcategoria().getId()).isEqualTo(subA); assertThat(p.getMarca().getId()).isEqualTo(marcaA);
        assertThat(p.getFornecedorPrincipal().getId()).isEqualTo(fornecedorA);
        assertThat(em.createQuery("select count(m) from MovimentacaoEstoqueEntity m",Long.class).getSingleResult()).isZero();
        mvc.perform(put("/produtos/"+p.getId()).header("Authorization",tokenA).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(dados(Map.of("nome","Editado"))))).andExpect(status().isOk()).andExpect(jsonPath("$.ncm").value("09011110"));
    }
    @Test void xlsxIgnoraFormulaDeSaldoERejeitaFormulaDeCampoImportado() throws Exception {
        try(var wb=new org.apache.poi.xssf.usermodel.XSSFWorkbook(); var bytes=new java.io.ByteArrayOutputStream()) {
            var sheet=wb.createSheet("Produtos");var header=sheet.createRow(0);
            String[] colunas={"Nome","Preço","Unidade","Código","Estoque Atual"};
            for(int c=0;c<colunas.length;c++) header.createCell(c).setCellValue(colunas[c]);
            for(int r=1;r<=2;r++) { var row=sheet.createRow(r);row.createCell(0).setCellValue("Produto "+r);row.createCell(1).setCellValue(10);row.createCell(2).setCellValue("UN");row.createCell(3).setCellValue("XLSX"+r);row.createCell(4).setCellFormula("100+100"); }
            sheet.getRow(2).getCell(1).setCellFormula("1+1");wb.write(bytes);
            var resposta=mvc.perform(multipart("/produtos/importacoes").file(new MockMultipartFile("arquivo","produtos.xlsx","application/octet-stream",bytes.toByteArray()))
                .header("Authorization",tokenA)).andExpect(status().isOk()).andExpect(jsonPath("$.validas").value(1)).andExpect(jsonPath("$.invalidas").value(1)).andReturn();
            String id=json.readTree(resposta.getResponse().getContentAsString()).get("id").asText();
            mvc.perform(post("/produtos/importacoes/"+id+"/confirmar").header("Authorization",tokenA)).andExpect(status().isOk()).andExpect(jsonPath("$.importados").value(1));
            assertThat(produtos.findAllByEmpresaIdOrderByNomeAsc(empresaA.getId()).getFirst().getEstoqueAtual()).isEqualByComparingTo("0");
        }
    }
    @Test void repeticaoDoArquivoEDaConfirmacaoNaoDuplicaProdutos() throws Exception {
        String csv=CAB+linha("Reenvio","RETRY","7891234567891","0"),id=previa(csv);
        assertThat(previa(csv)).isEqualTo(id);
        for(int i=0;i<2;i++) mvc.perform(post("/produtos/importacoes/"+id+"/confirmar").header("Authorization",tokenA)).andExpect(status().isOk()).andExpect(jsonPath("$.importados").value(1));
        assertThat(previa(csv)).isEqualTo(id); assertThat(produtos.count()).isEqualTo(1);
        mvc.perform(post("/produtos/importacoes/"+id+"/cancelar").header("Authorization",tokenA)).andExpect(status().isConflict());
    }
    @Test void contaInvalidasDuplicadasIgnoradasEImportaSomenteValidas() throws Exception {
        criar(tokenA,Map.of("codigoInterno","EXISTE"));
        String csv=CAB+linha("Válido","OK", "7891234567891","0")+linha("Duplicado","EXISTE","7891234567892","0")
            +linha("Rep1","REP","7891234567893","0")+linha("Rep2","REP","7891234567894","0")
            +linha("Inválido","INV","7891234567895","0").replace("12,50","-1")+";;;;;;;;;;;;;500\n";
        String id=previa(csv);
        mvc.perform(get("/produtos/importacoes/"+id).header("Authorization",tokenA)).andExpect(status().isOk())
            .andExpect(jsonPath("$.validas").value(1)).andExpect(jsonPath("$.duplicadas").value(3)).andExpect(jsonPath("$.invalidas").value(1)).andExpect(jsonPath("$.ignoradas").value(1));
        mvc.perform(post("/produtos/importacoes/"+id+"/confirmar").header("Authorization",tokenA)).andExpect(status().isOk()).andExpect(jsonPath("$.importados").value(1));
        assertThat(produtos.count()).isEqualTo(2);
    }
    @Test void referenciasAlheiasIncompativeisEAmbiguasSaoInvalidas() throws Exception {
        fornecedor(tokenA,"Distribuidora A");
        String id=previa(CAB+linha("Outra categoria","C1","","0").replace("Categoria A;Sub A","Categoria B;Sub B")
            +linha("Outra marca","C2","","0").replace("Marca A","Marca B")
            +linha("Subcategoria errada","C3","","0").replace("Categoria A;Sub A","Categoria A2;Sub A"));
        mvc.perform(get("/produtos/importacoes/"+id).header("Authorization",tokenA)).andExpect(status().isOk()).andExpect(jsonPath("$.invalidas").value(3));
        mvc.perform(post("/produtos/importacoes/"+id+"/confirmar").header("Authorization",tokenA)).andExpect(status().isConflict());
        assertThat(produtos.count()).isZero();
    }
    @Test void protegePermissaoETenantEPermiteCancelarSemGravar() throws Exception {
        mvc.perform(multipart("/produtos/importacoes").file(arquivo(CAB+linha("X","X","","0")))).andExpect(status().isUnauthorized());
        mvc.perform(multipart("/produtos/importacoes").file(arquivo(CAB+linha("X","X","","0"))).header("Authorization",operador)).andExpect(status().isForbidden());
        String id=previa(CAB+linha("Cancelável","CANCEL","","0"));
        for(String sufixo:new String[]{"","/erros"}) mvc.perform(get("/produtos/importacoes/"+id+sufixo).header("Authorization",tokenB)).andExpect(status().isNotFound());
        for(String acao:new String[]{"confirmar","cancelar"}) mvc.perform(post("/produtos/importacoes/"+id+"/"+acao).header("Authorization",tokenB)).andExpect(status().isNotFound());
        for(int i=0;i<2;i++) mvc.perform(post("/produtos/importacoes/"+id+"/cancelar").header("Authorization",tokenA)).andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("CANCELADA"));
        mvc.perform(post("/produtos/importacoes/"+id+"/confirmar").header("Authorization",tokenA)).andExpect(status().isConflict());
        assertThat(produtos.count()).isZero();
    }
    @Test void catalogoAlteradoAposPreviaBloqueiaLoteInteiroERelatorioEscapaFormula() throws Exception {
        String id=previa(CAB+linha("Um","CONCORRE","","0")+linha("Dois","NOVO","","0"));
        criar(tokenA,Map.of("codigoInterno","CONCORRE"));
        mvc.perform(post("/produtos/importacoes/"+id+"/confirmar").header("Authorization",tokenA)).andExpect(status().isConflict());
        assertThat(produtos.count()).isEqualTo(1);
        String erro=previa(CAB+linha("=HYPERLINK(ruim)","ERRO","","0").replace("12,50","texto"));
        var resposta=mvc.perform(get("/produtos/importacoes/"+erro+"/erros").header("Authorization",tokenA)).andExpect(status().isOk())
            .andExpect(header().string("Content-Disposition","attachment; filename=erros-importacao-produtos.csv")).andReturn();
        assertThat(resposta.getResponse().getContentAsString(StandardCharsets.UTF_8)).contains("Linha;Situação").contains("\"'=HYPERLINK");
    }
}
