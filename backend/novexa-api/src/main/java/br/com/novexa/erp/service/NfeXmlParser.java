package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.EntradaXmlPreviewDTO;
import br.com.novexa.erp.exception.DocumentoInvalidoException;
import br.com.novexa.erp.util.DocumentoUtils;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import javax.xml.XMLConstants;
import javax.xml.stream.*;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.*;

@Component
public class NfeXmlParser {
    private static final String NAMESPACE = "http://www.portalfiscal.inf.br/nfe";
    private static final Set<String> CAMPOS = Set.of("ide/nNF", "ide/serie", "ide/dhEmi", "ide/dEmi",
            "emit/CNPJ", "emit/CPF", "emit/xNome", "emit/xFant", "total/ICMSTot/vProd", "total/ICMSTot/vNF");
    private static final Set<String> CAMPOS_PRODUTO = Set.of("cProd", "xProd", "cEAN", "cEANTrib", "NCM",
            "CFOP", "uCom", "qCom", "vUnCom", "vProd");

    public EntradaXmlPreviewDTO ler(byte[] xml) {
        var factory = XMLInputFactory.newFactory();
        factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        factory.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
        factory.setProperty(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        factory.setXMLResolver((publicId, systemId, base, namespace) -> {
            throw new XMLStreamException("Recursos externos bloqueados.");
        });
        XMLStreamReader reader = null;
        try {
            reader = factory.createXMLStreamReader(new ByteArrayInputStream(xml));
            return extrair(reader);
        } catch (XMLStreamException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "XML malformado ou inseguro.");
        } finally {
            if (reader != null) try { reader.close(); } catch (XMLStreamException ignored) { }
        }
    }

    private EntradaXmlPreviewDTO extrair(XMLStreamReader r) throws XMLStreamException {
        Deque<String> caminho = new ArrayDeque<>();
        Map<String, String> cabecalho = new HashMap<>(), produto = null;
        List<EntradaXmlPreviewDTO.Item> itens = new ArrayList<>();
        String base = null, chave = null, campo = null;
        StringBuilder texto = null;
        int notas = 0;
        while (r.hasNext()) {
            int evento = r.next();
            if (evento == XMLStreamConstants.DTD || evento == XMLStreamConstants.ENTITY_REFERENCE)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "DTD e entidades nao sao permitidos.");
            if (evento == XMLStreamConstants.START_ELEMENT) {
                if (texto != null) throw invalida("Campo XML com estrutura invalida.");
                String nome = r.getLocalName();
                boolean namespaceNfe = NAMESPACE.equals(r.getNamespaceURI());
                if (caminho.isEmpty()) {
                    if (!namespaceNfe || !(nome.equals("NFe") || nome.equals("nfeProc")))
                        throw invalida("Arquivo nao representa uma NF-e.");
                    base = nome.equals("NFe") ? "NFe/infNFe" : "nfeProc/NFe/infNFe";
                }
                caminho.addLast(namespaceNfe ? nome : "@" + nome);
                if (caminho.size() > 32) throw invalida("XML excede a profundidade permitida.");
                String atual = String.join("/", caminho);
                if (atual.equals("NFe") || atual.equals("nfeProc/NFe")) {
                    if (++notas > 1) throw invalida("Envie apenas uma NF-e por arquivo.");
                }
                if (atual.equals(base)) {
                    if (chave != null) throw invalida("NF-e com identificacao duplicada.");
                    String id = r.getAttributeValue(null, "Id");
                    if (id == null || !id.matches("NFe[0-9]{44}")) throw invalida("Chave NF-e deve conter 44 digitos.");
                    chave = id.substring(3);
                } else if (atual.equals(base + "/det")) {
                    if (itens.size() >= 200) throw invalida("NF-e deve possuir no maximo 200 itens.");
                    produto = new HashMap<>();
                } else if (atual.startsWith(base + "/")) {
                    String relativo = atual.substring(base.length() + 1);
                    if (CAMPOS.contains(relativo) || (relativo.startsWith("det/prod/")
                            && CAMPOS_PRODUTO.contains(relativo.substring("det/prod/".length())))) {
                        campo = relativo; texto = new StringBuilder();
                    }
                }
            } else if (evento == XMLStreamConstants.CHARACTERS || evento == XMLStreamConstants.CDATA) {
                if (texto != null) {
                    if (texto.length() + r.getTextLength() > 4096) throw invalida("Campo XML excede o tamanho permitido.");
                    texto.append(r.getText());
                }
            } else if (evento == XMLStreamConstants.END_ELEMENT) {
                if (texto != null) {
                    Map<String, String> destino = campo.startsWith("det/prod/") ? produto : cabecalho;
                    String nome = campo.startsWith("det/prod/") ? campo.substring("det/prod/".length()) : campo;
                    if (destino == null || destino.putIfAbsent(nome, texto.toString().trim()) != null)
                        throw invalida("Campo XML duplicado ou fora do item.");
                    texto = null; campo = null;
                }
                if (String.join("/", caminho).equals(base + "/det")) {
                    itens.add(item(produto)); produto = null;
                }
                caminho.removeLast();
            }
        }
        if (chave == null || itens.isEmpty() || notas != 1) throw invalida("NF-e incompleta: cabecalho e itens sao obrigatorios.");
        String documento = opcional(cabecalho, "emit/CNPJ", 14);
        String cpf = opcional(cabecalho, "emit/CPF", 11);
        if (documento != null && cpf != null) throw invalida("Informe somente um documento do emitente.");
        try { documento = DocumentoUtils.normalizarEValidarCpfCnpj(documento == null ? cpf : documento); }
        catch (DocumentoInvalidoException e) { throw invalida("Documento do emitente invalido."); }
        if (documento == null) throw invalida("Documento do emitente obrigatorio.");
        return new EntradaXmlPreviewDTO(new EntradaXmlPreviewDTO.FornecedorXml(documento,
                obrigatorio(cabecalho, "emit/xNome", 255), opcional(cabecalho, "emit/xFant", 255)), null,
                obrigatorio(cabecalho, "ide/nNF", 60), obrigatorio(cabecalho, "ide/serie", 20), chave, data(cabecalho),
                decimal(cabecalho, "total/ICMSTot/vProd", false), decimal(cabecalho, "total/ICMSTot/vNF", false), List.copyOf(itens));
    }

    private EntradaXmlPreviewDTO.Item item(Map<String, String> p) {
        return new EntradaXmlPreviewDTO.Item(obrigatorio(p, "cProd", 60), obrigatorio(p, "xProd", 255),
                Optional.ofNullable(gtin(opcional(p, "cEAN", 30))).orElseGet(() -> gtin(opcional(p, "cEANTrib", 30))),
                opcional(p, "NCM", 8), opcional(p, "CFOP", 4), obrigatorio(p, "uCom", 10),
                decimal(p, "qCom", true), decimal(p, "vUnCom", false), decimal(p, "vProd", false), null);
    }

    static String gtin(String valor) {
        if (valor == null || !valor.matches("(?:[0-9]{8}|[0-9]{12,14})") || valor.matches("0+")) return null;
        int soma = 0, peso = 3;
        for (int i = valor.length() - 2; i >= 0; i--) { soma += (valor.charAt(i) - '0') * peso; peso = peso == 3 ? 1 : 3; }
        return (10 - soma % 10) % 10 == valor.charAt(valor.length() - 1) - '0' ? valor : null;
    }
    private static BigDecimal decimal(Map<String, String> dados, String campo, boolean positivo) {
        String texto = obrigatorio(dados, campo, 40);
        if (!texto.matches("[0-9]+(?:\\.[0-9]+)?")) throw invalida("Valor numerico invalido na NF-e.");
        BigDecimal valor = new BigDecimal(texto);
        if (valor.precision() > 29 || valor.scale() > 10 || (positivo && valor.signum() <= 0))
            throw invalida("Quantidade ou valor invalido na NF-e.");
        return valor;
    }
    private static LocalDate data(Map<String, String> dados) {
        String dataHora = opcional(dados, "ide/dhEmi", 40);
        try { return dataHora == null ? LocalDate.parse(obrigatorio(dados, "ide/dEmi", 10)) : OffsetDateTime.parse(dataHora).toLocalDate(); }
        catch (DateTimeParseException e) { throw invalida("Data de emissao invalida."); }
    }
    private static String obrigatorio(Map<String, String> dados, String campo, int limite) {
        String valor = opcional(dados, campo, limite);
        if (valor == null) throw invalida("NF-e incompleta: campo " + campo + " obrigatorio.");
        return valor;
    }
    private static String opcional(Map<String, String> dados, String campo, int limite) {
        String valor = dados == null ? null : dados.get(campo);
        if (valor == null || valor.isBlank()) return null;
        if (valor.length() > limite) throw invalida("Campo XML excede o tamanho permitido.");
        return valor;
    }
    private static ResponseStatusException invalida(String mensagem) {
        return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, mensagem);
    }
}
