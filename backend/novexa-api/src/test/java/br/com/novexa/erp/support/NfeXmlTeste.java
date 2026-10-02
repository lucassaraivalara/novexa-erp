package br.com.novexa.erp.support;

public final class NfeXmlTeste {
    public static final String CHAVE = "35261011222333000181550010000001231000001234";
    public static final String GTIN = "4006381333931";
    private NfeXmlTeste() { }
    public static String xml() {
        return """
            <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
              <infNFe Id="NFe%s" versao="4.00">
                <ide><nNF>123</nNF><serie>1</serie><dhEmi>2026-10-02T23:30:00-03:00</dhEmi></ide>
                <emit><CNPJ>11222333000181</CNPJ><xNome>Distribuidora XML</xNome><xFant>ABC</xFant></emit>
                <det nItem="1"><prod><cProd>ABC-01</cProd><xProd>Descricao original</xProd>
                  <cEAN>%s</cEAN><cEANTrib>SEM GTIN</cEANTrib><NCM>12345678</NCM><CFOP>5102</CFOP>
                  <uCom>UN</uCom><qCom>2.125</qCom><vUnCom>3.50</vUnCom><vProd>7.44</vProd>
                </prod></det>
                <total><ICMSTot><vProd>7.44</vProd><vNF>8.44</vNF></ICMSTot></total>
              </infNFe>
            </NFe>
            """.formatted(CHAVE, GTIN);
    }
    public static String processado() {
        return "<nfeProc xmlns=\"http://www.portalfiscal.inf.br/nfe\" versao=\"4.00\">" + xml()
                + "<protNFe><infProt><chNFe>" + CHAVE + "</chNFe></infProt></protNFe></nfeProc>";
    }
}
