package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.EntradaXmlPreviewDTO;
import br.com.novexa.erp.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.unit.DataSize;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import java.io.IOException;

@Service
@Transactional(readOnly = true)
public class EntradaXmlService {
    private final NfeXmlParser parser;
    private final EntradaMercadoriaRepository entradas;
    private final FornecedorRepository fornecedores;
    private final ProdutoRepository produtos;
    private final ProdutoFornecedorRepository vinculosFornecedores;
    private final int limite;

    public EntradaXmlService(NfeXmlParser parser, EntradaMercadoriaRepository entradas,
            FornecedorRepository fornecedores, ProdutoRepository produtos, ProdutoFornecedorRepository vinculosFornecedores,
            @Value("${spring.servlet.multipart.max-file-size:2MB}") DataSize tamanhoMaximo) {
        this.parser = parser; this.entradas = entradas; this.fornecedores = fornecedores; this.produtos = produtos;
        this.vinculosFornecedores = vinculosFornecedores;
        long bytes = tamanhoMaximo.toBytes();
        if (bytes <= 0 || bytes >= Integer.MAX_VALUE) throw new IllegalArgumentException("Limite XML deve ser positivo e finito.");
        this.limite = (int) bytes;
    }

    public EntradaXmlPreviewDTO preview(MultipartFile arquivo, Long empresaId) {
        if (arquivo.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Envie um arquivo XML nao vazio.");
        if (arquivo.getSize() > limite) throw tamanhoExcedido();
        byte[] xml;
        try (var stream = arquivo.getInputStream()) { xml = stream.readNBytes(limite + 1); }
        catch (IOException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nao foi possivel ler o arquivo XML."); }
        if (xml.length > limite) throw tamanhoExcedido();
        var previa = parser.ler(xml);
        if (entradas.existsByEmpresaIdAndChaveAcessoNfe(empresaId, previa.chaveAcessoNfe()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Nota fiscal ja importada/cadastrada.");
        var fornecedor = fornecedores.buscarPorDocumentoExato(empresaId, previa.fornecedorXml().cpfCnpj())
                .map(f -> new EntradaXmlPreviewDTO.FornecedorMatch(f.getId(), f.getRazaoSocial(), Boolean.TRUE.equals(f.getAtivo())))
                .orElse(null);
        Long fornecedorId = fornecedor == null ? null : fornecedor.id();
        var itens = previa.itens().stream().map(i -> i.comMatch(matchProduto(empresaId, fornecedorId, i))).toList();
        return new EntradaXmlPreviewDTO(previa.fornecedorXml(), fornecedor, previa.numeroNota(), previa.serie(),
                previa.chaveAcessoNfe(), previa.dataEmissao(), previa.valorProdutos(), previa.valorTotal(), itens);
    }
    // Match por GTIN; na ausencia, pela carteira de codigos de fabricante do fornecedor (memoria V52).
    private EntradaXmlPreviewDTO.ProdutoMatch matchProduto(Long empresaId, Long fornecedorId, EntradaXmlPreviewDTO.Item item) {
        if (item.gtin() != null) {
            var porGtin = produtos.findByEmpresaIdAndCodigoBarrasAndAtivoTrue(empresaId, item.gtin());
            if (porGtin.isPresent()) {
                var p = porGtin.get();
                return new EntradaXmlPreviewDTO.ProdutoMatch(p.getId(), p.getNome(), p.getCodigoBarras());
            }
        }
        if (fornecedorId != null && item.codigoProdutoFornecedor() != null) {
            var porCodigo = vinculosFornecedores.findByEmpresaIdAndFornecedorIdAndCodigoReferencia(
                    empresaId, fornecedorId, item.codigoProdutoFornecedor());
            if (porCodigo.isPresent()) {
                var p = porCodigo.get().getProduto();
                return new EntradaXmlPreviewDTO.ProdutoMatch(p.getId(), p.getNome(), p.getCodigoBarras());
            }
        }
        return null;
    }

    private static ResponseStatusException tamanhoExcedido() {
        return new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Arquivo XML excede o tamanho permitido.");
    }
}
