package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.OrigemEntradaMercadoria;
import br.com.novexa.erp.entity.StatusEntradaMercadoria;
import br.com.novexa.erp.support.NfeXmlTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.ResultActions;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class EntradaXmlHttpTest extends EntradaMercadoriaHttpTest {
    @BeforeEach void dadosXml() {
        fornecedor.setCpfCnpj("11222333000181"); fornecedores.saveAndFlush(fornecedor);
        produto.setCodigoBarras(NfeXmlTeste.GTIN); produtos.saveAndFlush(produto);
    }
    ResultActions preview(String xml, String token) throws Exception {
        return mvc.perform(multipart("/estoque/entradas/importar-xml")
                .file(new MockMultipartFile("arquivo", "nao-confiar.txt", "application/octet-stream", xml.getBytes(StandardCharsets.UTF_8)))
                .header("Authorization", token));
    }
    Map<String, Object> pedidoXml() {
        var p = pedido(); p.put("chaveAcessoNfe", NfeXmlTeste.CHAVE); p.put("numeroNota", "123"); p.put("serie", "1");
        var i = item(produto, "2.125", "3.50");
        i.putAll(Map.of("descricaoOriginal", "Descricao original", "codigoProdutoFornecedor", "ABC-01", "gtin", NfeXmlTeste.GTIN,
                "ncm", "12345678", "cfop", "5102", "unidade", "UN", "valorTotal", 999));
        p.put("itens", List.of(i)); p.put("valorTotal", 999); p.put("empresaId", outra.getId()); p.put("status", "CONFIRMADA");
        return p;
    }
    ResultActions fromXml(Map<String, Object> dados) throws Exception { return fromXml(dados, authorization); }
    ResultActions fromXml(Map<String, Object> dados, String token) throws Exception {
        return mvc.perform(post("/estoque/entradas/from-xml").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(dados)));
    }
    @Test void xmlPreviewFazMatchesExatosSemPersistirOuAlterarEstoque() throws Exception {
        preview(NfeXmlTeste.processado(), authorization).andExpect(status().isOk())
                .andExpect(jsonPath("$.fornecedorMatch.id").value(fornecedor.getId())).andExpect(jsonPath("$.fornecedorMatch.ativo").value(true))
                .andExpect(jsonPath("$.itens[0].produtoMatch.id").value(produto.getId()))
                .andExpect(jsonPath("$.valorTotal").value(8.44)).andExpect(jsonPath("$.itens[0].quantidade").value(2.125));
        assertThat(entradas.count()).isZero(); assertThat(movimentos.count()).isZero();
        assertThat(fornecedores.count()).isEqualTo(2); assertThat(produtos.count()).isEqualTo(3);
        assertThat(saldo(produto)).isEqualByComparingTo("10");
        assertThat(produtos.findById(produto.getId()).orElseThrow().getPrecoCusto()).isEqualByComparingTo("2");
    }
    @Test void xmlPreviewNaoCasaOutroTenantERetornaEmitenteParaCadastro() throws Exception {
        preview(NfeXmlTeste.xml(), authorizationB).andExpect(status().isOk()).andExpect(jsonPath("$.fornecedorMatch").isEmpty())
                .andExpect(jsonPath("$.itens[0].produtoMatch").isEmpty()).andExpect(jsonPath("$.fornecedorXml.cpfCnpj").value("11222333000181"))
                .andExpect(jsonPath("$.fornecedorXml.razaoSocial").value("Distribuidora XML"));
    }
    @Test void xmlFornecedorInativoSinalizadoEProdutoInativoNaoCasa() throws Exception {
        fornecedor.setAtivo(false); fornecedores.saveAndFlush(fornecedor); produto.setAtivo(false); produtos.saveAndFlush(produto);
        preview(NfeXmlTeste.xml(), authorization).andExpect(status().isOk()).andExpect(jsonPath("$.fornecedorMatch.ativo").value(false))
                .andExpect(jsonPath("$.itens[0].produtoMatch").isEmpty());
    }
    @Test void xmlFornecedorComCpfHistoricoMascaradoCasaPorDocumentoNormalizado() throws Exception {
        fornecedor.setCpfCnpj("111.444.777-35"); fornecedores.saveAndFlush(fornecedor);
        preview(NfeXmlTeste.xml().replace("<CNPJ>11222333000181</CNPJ>", "<CPF>11144477735</CPF>"), authorization)
                .andExpect(status().isOk()).andExpect(jsonPath("$.fornecedorMatch.id").value(fornecedor.getId()));
    }
    @Test void xmlDocumentoEBarcodeExigemIgualdadeSemMatchingPorDescricao() throws Exception {
        fornecedor.setCpfCnpj("1122233300018"); fornecedores.saveAndFlush(fornecedor);
        produto.setCodigoBarras(NfeXmlTeste.GTIN + "0"); produto.setNome("Descricao original"); produtos.saveAndFlush(produto);
        preview(NfeXmlTeste.xml(), authorization).andExpect(status().isOk()).andExpect(jsonPath("$.fornecedorMatch").isEmpty())
                .andExpect(jsonPath("$.itens[0].produtoMatch").isEmpty());
    }
    @Test void xmlSemGtinNaoFazMatchingPorNome() throws Exception {
        preview(NfeXmlTeste.xml().replace(NfeXmlTeste.GTIN, "SEM GTIN"), authorization).andExpect(status().isOk())
                .andExpect(jsonPath("$.itens[0].gtin").isEmpty()).andExpect(jsonPath("$.itens[0].produtoMatch").isEmpty());
    }
    @Test void xmlArquivoInvalidoVazioEGrandeRejeitados() throws Exception {
        preview("", authorization).andExpect(status().isBadRequest()); preview("<outro/>", authorization).andExpect(status().isUnprocessableEntity());
        preview("<NFe", authorization).andExpect(status().isBadRequest());
        preview(" ".repeat(2 * 1024 * 1024 + 1), authorization).andExpect(status().isPayloadTooLarge());
        assertThat(entradas.count()).isZero();
    }
    @Test void xmlNaoAutenticadoNaoImportaOuCria() throws Exception {
        mvc.perform(multipart("/estoque/entradas/importar-xml").file(new MockMultipartFile("arquivo", NfeXmlTeste.xml().getBytes(StandardCharsets.UTF_8))))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/estoque/entradas/from-xml").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(pedidoXml())))
                .andExpect(status().isUnauthorized());
    }
    @Test void xmlCriaRascunhoHistoricoTotaisCanonicosSemMovimentarEConfirmaNoFluxoAtual() throws Exception {
        long id = id(fromXml(pedidoXml()).andExpect(status().isCreated()).andExpect(jsonPath("$.origem").value("XML"))
                .andExpect(jsonPath("$.status").value("RASCUNHO")).andExpect(jsonPath("$.valorTotal").value(7.44))
                .andExpect(jsonPath("$.itens[0].valorTotal").value(7.44)).andExpect(jsonPath("$.itens[0].descricaoOriginal").value("Descricao original"))
                .andExpect(jsonPath("$.itens[0].codigoProdutoFornecedor").value("ABC-01")).andExpect(jsonPath("$.itens[0].gtin").value(NfeXmlTeste.GTIN))
                .andExpect(jsonPath("$.itens[0].ncm").value("12345678")).andExpect(jsonPath("$.itens[0].cfop").value("5102"))
                .andExpect(jsonPath("$.itens[0].unidade").value("UN")));
        var e = entradas.findById(id).orElseThrow(); assertThat(e.getEmpresa().getId()).isEqualTo(empresa.getId());
        assertThat(e.getOrigem()).isEqualTo(OrigemEntradaMercadoria.XML); assertThat(e.getStatus()).isEqualTo(StatusEntradaMercadoria.RASCUNHO);
        assertThat(movimentos.count()).isZero(); assertThat(saldo(produto)).isEqualByComparingTo("10");
        assertThat(produtos.findById(produto.getId()).orElseThrow().getPrecoCusto()).isEqualByComparingTo("2");
        operacao(id, "confirmar").andExpect(status().isOk()); operacao(id, "confirmar").andExpect(status().isOk());
        assertThat(saldo(produto)).isEqualByComparingTo("12.125"); assertThat(movimentos.count()).isEqualTo(1);
        operacao(id, "cancelar").andExpect(status().isOk()); assertThat(saldo(produto)).isEqualByComparingTo("10");
    }
    @Test void xmlChaveObrigatoriaEQuantidadesCustosValidados() throws Exception {
        var p = pedidoXml(); p.remove("chaveAcessoNfe"); fromXml(p).andExpect(status().isBadRequest());
        p.put("chaveAcessoNfe", "123"); fromXml(p).andExpect(status().isBadRequest());
        p.put("chaveAcessoNfe", NfeXmlTeste.CHAVE); p.put("itens", List.of(item(produto, "0", "1"))); fromXml(p).andExpect(status().isBadRequest());
        p.put("itens", List.of(item(produto, "1", "-1"))); fromXml(p).andExpect(status().isBadRequest());
    }
    @Test void xmlExigeFornecedorEProdutoAtivosDoTenant() throws Exception {
        var p = pedidoXml(); p.remove("fornecedorId"); fromXml(p).andExpect(status().isBadRequest());
        p.put("fornecedorId", fornecedorB.getId()); fromXml(p).andExpect(status().isNotFound());
        p.put("fornecedorId", fornecedor.getId()); p.put("itens", List.of(item(produtoB, "1", "1"))); fromXml(p).andExpect(status().isNotFound());
        p.put("itens", List.of(item(produto, "1", "1"))); fornecedor.setAtivo(false); fornecedores.saveAndFlush(fornecedor);
        fromXml(p).andExpect(status().isConflict()); fornecedor.setAtivo(true); fornecedores.saveAndFlush(fornecedor);
        produto.setAtivo(false); produtos.saveAndFlush(produto); fromXml(p).andExpect(status().isConflict());
        assertThat(entradas.count()).isZero(); assertThat(movimentos.count()).isZero();
    }
    @Test void xmlDuplicidadeBloqueiaPreviewECriacaoMasNaoOutroTenant() throws Exception {
        fromXml(pedidoXml()).andExpect(status().isCreated());
        preview(NfeXmlTeste.xml(), authorization).andExpect(status().isConflict()).andExpect(content().string("Nota fiscal ja importada/cadastrada."));
        fromXml(pedidoXml()).andExpect(status().isConflict()); preview(NfeXmlTeste.xml(), authorizationB).andExpect(status().isOk());
        var p = pedidoXml(); p.put("fornecedorId", fornecedorB.getId()); p.put("itens", List.of(item(produtoB, "1", "1")));
        fromXml(p, authorizationB).andExpect(status().isCreated());
    }
    @Test void xmlIdempotenciaNaoConfundeOrigemManual() throws Exception {
        var p = pedidoXml(); p.put("chaveRequisicao", UUID.randomUUID());
        long id = id(fromXml(p).andExpect(status().isCreated()));
        fromXml(p).andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(id));
        criar(p).andExpect(status().isConflict()); assertThat(entradas.count()).isEqualTo(1);
    }
}
