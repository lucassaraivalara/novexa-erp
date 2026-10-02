package br.com.novexa.erp.service;

import br.com.novexa.erp.support.NfeXmlTeste;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.web.server.ResponseStatusException;
import java.nio.charset.StandardCharsets;
import static org.assertj.core.api.Assertions.*;

class NfeXmlParserTest {
    private final NfeXmlParser parser = new NfeXmlParser();
    private br.com.novexa.erp.dto.EntradaXmlPreviewDTO ler(String xml) { return parser.ler(xml.getBytes(StandardCharsets.UTF_8)); }
    private void rejeitar(String xml, int status) {
        assertThatThrownBy(() -> ler(xml)).isInstanceOfSatisfying(ResponseStatusException.class,
                e -> assertThat(e.getStatusCode().value()).isEqualTo(status));
    }
    @Test void nfeExtraiCabecalhoEmitenteTotaisEItens() {
        var p = ler(NfeXmlTeste.xml());
        assertThat(p.chaveAcessoNfe()).isEqualTo(NfeXmlTeste.CHAVE);
        assertThat(p.numeroNota()).isEqualTo("123"); assertThat(p.serie()).isEqualTo("1");
        assertThat(p.dataEmissao()).hasToString("2026-10-02");
        assertThat(p.fornecedorXml().cpfCnpj()).isEqualTo("11222333000181");
        assertThat(p.fornecedorXml().razaoSocial()).isEqualTo("Distribuidora XML"); assertThat(p.fornecedorXml().nomeFantasia()).isEqualTo("ABC");
        assertThat(p.valorProdutos()).isEqualByComparingTo("7.44"); assertThat(p.valorTotal()).isEqualByComparingTo("8.44");
        var i = p.itens().getFirst();
        assertThat(i.codigoProdutoFornecedor()).isEqualTo("ABC-01"); assertThat(i.descricaoOriginal()).isEqualTo("Descricao original");
        assertThat(i.gtin()).isEqualTo(NfeXmlTeste.GTIN); assertThat(i.ncm()).isEqualTo("12345678");
        assertThat(i.cfop()).isEqualTo("5102"); assertThat(i.unidade()).isEqualTo("UN");
        assertThat(i.quantidade()).isEqualByComparingTo("2.125"); assertThat(i.valorUnitario()).isEqualByComparingTo("3.50");
        assertThat(i.valorTotal()).isEqualByComparingTo("7.44"); assertThat(p.fornecedorMatch()).isNull(); assertThat(i.produtoMatch()).isNull();
    }
    @Test void nfeProcAceito() { assertThat(ler(NfeXmlTeste.processado()).chaveAcessoNfe()).isEqualTo(NfeXmlTeste.CHAVE); }
    @Test void namespaceComPrefixoIndependente() {
        String xml = NfeXmlTeste.xml().replace("xmlns=", "xmlns:n=").replaceAll("<(\\/?)([A-Za-z][A-Za-z0-9]*)", "<$1n:$2");
        assertThat(ler(xml).itens()).hasSize(1);
    }
    @Test void valoresDecimaisOriginaisNaoSaoArredondados() {
        var i = ler(NfeXmlTeste.xml().replace("3.50", "3.1234567890").replace("2.125", "2.1234")).itens().getFirst();
        assertThat(i.valorUnitario().toPlainString()).isEqualTo("3.1234567890"); assertThat(i.quantidade().toPlainString()).isEqualTo("2.1234");
    }
    @Test void variosItensMantemOrdem() {
        String xml = NfeXmlTeste.xml(); String item = xml.substring(xml.indexOf("<det"), xml.indexOf("</det>") + 6);
        var p = ler(xml.replace("</det>", "</det>" + item.replace("ABC-01", "ABC-02")));
        assertThat(p.itens()).hasSize(2); assertThat(p.itens().get(1).codigoProdutoFornecedor()).isEqualTo("ABC-02");
    }
    @Test void dataAntigaSemHoraECpfDoEmitente() {
        String xml = NfeXmlTeste.xml().replace("<dhEmi>2026-10-02T23:30:00-03:00</dhEmi>", "<dEmi>2026-10-01</dEmi>")
                .replace("<CNPJ>11222333000181</CNPJ>", "<CPF>11144477735</CPF>");
        assertThat(ler(xml).dataEmissao()).hasToString("2026-10-01"); assertThat(ler(xml).fornecedorXml().cpfCnpj()).isEqualTo("11144477735");
    }
    @Test void xmlMalformado() { rejeitar(NfeXmlTeste.xml().replace("</NFe>", ""), 400); }
    @ParameterizedTest @ValueSource(strings = {"<produto/>", "<NFe/>", "<NFe xmlns='urn:falso'/>", "<NFe xmlns='http://www.portalfiscal.inf.br/nfe'/>"})
    void conteudoNaoNfeOuIncompleto(String xml) { rejeitar(xml, 422); }
    @ParameterizedTest @ValueSource(strings = {"<!DOCTYPE NFe>",
            "<!DOCTYPE NFe SYSTEM 'http://127.0.0.1:9/segredo'>",
            "<!DOCTYPE NFe [<!ENTITY xxe SYSTEM 'file:///nao-ler'>]>",
            "<!DOCTYPE NFe [<!ENTITY a 'expansao'><!ENTITY b '&a;&a;'>]>"})
    void dtdEntidadesExternasEExpansaoBloqueadas(String dtd) { rejeitar(dtd + NfeXmlTeste.xml(), 400); }
    @ParameterizedTest @ValueSource(strings = {"SEM GTIN", "", "0000000000000", "123", "4006381333932"})
    void gtinInvalidoOuAusenteNaoViraMatch(String gtin) {
        assertThat(ler(NfeXmlTeste.xml().replace(NfeXmlTeste.GTIN, gtin)).itens().getFirst().gtin()).isNull();
    }
    @Test void gtinTributarioValidoComoAlternativa() {
        String xml = NfeXmlTeste.xml().replace(NfeXmlTeste.GTIN, "SEM GTIN").replace("<cEANTrib>SEM GTIN</cEANTrib>", "<cEANTrib>" + NfeXmlTeste.GTIN + "</cEANTrib>");
        assertThat(ler(xml).itens().getFirst().gtin()).isEqualTo(NfeXmlTeste.GTIN);
    }
    @ParameterizedTest @ValueSource(strings = {"<vUnCom>-1</vUnCom>", "<vUnCom>1e10</vUnCom>", "<vUnCom>texto</vUnCom>"})
    void valorNumericoInvalido(String valor) { rejeitar(NfeXmlTeste.xml().replace("<vUnCom>3.50</vUnCom>", valor), 422); }
    @Test void quantidadeZeroRejeitada() { rejeitar(NfeXmlTeste.xml().replace("<qCom>2.125</qCom>", "<qCom>0</qCom>"), 422); }
    @Test void chaveInvalidaRejeitada() { rejeitar(NfeXmlTeste.xml().replace("NFe" + NfeXmlTeste.CHAVE, "NFe123"), 422); }
    @Test void documentoInvalidoRejeitado() { rejeitar(NfeXmlTeste.xml().replace("11222333000181", "11111111111111"), 422); }
    @Test void campoDuplicadoRejeitado() { rejeitar(NfeXmlTeste.xml().replace("<nNF>123</nNF>", "<nNF>123</nNF><nNF>456</nNF>"), 422); }
    @Test void namespaceEstranhoNaoSubstituiCampoDaNfe() {
        rejeitar(NfeXmlTeste.xml().replace("<emit>", "<emit xmlns='urn:falso'>"), 422);
    }
    @Test void nfeProcComDuasNotasRejeitado() {
        rejeitar("<nfeProc xmlns='http://www.portalfiscal.inf.br/nfe'>" + NfeXmlTeste.xml() + NfeXmlTeste.xml() + "</nfeProc>", 422);
    }
}
