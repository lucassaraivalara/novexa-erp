package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.ImportacaoProdutoDTO;
import br.com.novexa.erp.service.ImportacaoProdutoService;
import br.com.novexa.erp.security.UsuarioAutenticado;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.web.multipart.MultipartFile;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@RestController
@RequestMapping("/produtos/importacoes")
public class ImportacaoProdutoController {
    private final ImportacaoProdutoService service;
    public ImportacaoProdutoController(ImportacaoProdutoService service) { this.service=service; }
    @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ImportacaoProdutoDTO previa(@RequestPart("arquivo") MultipartFile arquivo,@AuthenticationPrincipal UsuarioAutenticado usuario) { return service.previa(arquivo,usuario); }
    @GetMapping("/{id}")
    public ImportacaoProdutoDTO consultar(@PathVariable UUID id,@AuthenticationPrincipal UsuarioAutenticado usuario) { return service.consultar(id,usuario.empresaId()); }
    @PostMapping("/{id}/confirmar")
    public ImportacaoProdutoDTO confirmar(@PathVariable UUID id,@AuthenticationPrincipal UsuarioAutenticado usuario) { return service.confirmar(id,usuario.empresaId()); }
    @PostMapping("/{id}/cancelar")
    public ImportacaoProdutoDTO cancelar(@PathVariable UUID id,@AuthenticationPrincipal UsuarioAutenticado usuario) { return service.cancelar(id,usuario.empresaId()); }
    @GetMapping(value="/{id}/erros",produces="text/csv")
    public ResponseEntity<byte[]> erros(@PathVariable UUID id,@AuthenticationPrincipal UsuarioAutenticado usuario) {
        var previa=service.consultar(id,usuario.empresaId());
        var csv=new StringBuilder("\uFEFFLinha;Situação;Nome;Código;Motivo\r\n");
        for(var linha:previa.linhas()) if(!"VALIDA".equals(linha.situacao()))
            csv.append(linha.linha()).append(';').append(celula(linha.situacao())).append(';')
                .append(celula(linha.campos().get("nome"))).append(';').append(celula(linha.campos().get("codigoInterno"))).append(';')
                .append(celula(linha.mensagem())).append("\r\n");
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=erros-importacao-produtos.csv")
            .contentType(new MediaType("text","csv",StandardCharsets.UTF_8)).body(csv.toString().getBytes(StandardCharsets.UTF_8));
    }
    private static String celula(String texto) {
        String valor=texto==null?"":texto;
        if(valor.stripLeading().matches("(?s)^[=+@\\-].*") || valor.startsWith("\t") || valor.startsWith("\r")) valor="'"+valor;
        return "\""+valor.replace("\"","\"\"")+"\"";
    }
    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<String> conflitoConcorrente(org.springframework.dao.DataIntegrityViolationException erro) {
        if(erro.getMostSpecificCause() instanceof java.sql.SQLException sql && ("23505".equals(sql.getSQLState()) || "23503".equals(sql.getSQLState())))
            return ResponseEntity.status(HttpStatus.CONFLICT).body("O catálogo mudou durante a importação. Nenhum produto deste lote foi gravado. Reenvie o arquivo para revisar códigos e vínculos.");
        throw erro;
    }
}
