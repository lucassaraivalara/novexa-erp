package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.ImportacaoEstoqueDTO;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.ImportacaoEstoqueService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/estoque/ajustes-lote/importacao")
public class ImportacaoEstoqueController {
    private final ImportacaoEstoqueService service;
    public ImportacaoEstoqueController(ImportacaoEstoqueService service) { this.service = service; }

    @PostMapping(value = "/previa", consumes = "multipart/form-data")
    public ImportacaoEstoqueDTO.Previa previa(@RequestPart("arquivo") MultipartFile arquivo,
            @RequestPart("motivo") String motivo, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.previa(arquivo, motivo, usuario);
    }

    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    public ResponseEntity<String> arquivoAcimaDoLimite(org.springframework.web.multipart.MaxUploadSizeExceededException exception) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body("O arquivo excede o limite de 2 MiB.");
    }
}
