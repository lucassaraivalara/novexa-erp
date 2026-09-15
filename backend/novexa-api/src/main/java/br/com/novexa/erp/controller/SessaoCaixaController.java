package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.SessaoCaixaService;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/financeiro/caixas/{caixaId}/sessoes")
public class SessaoCaixaController {
    private final SessaoCaixaService service;
    public SessaoCaixaController(SessaoCaixaService service) { this.service = service; }

    @PostMapping
    public ResponseEntity<SessaoCaixaResponseDTO> abrir(@PathVariable Long caixaId,
            @Valid @RequestBody AberturaCaixaDTO request, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.abrir(caixaId, request.saldoInicial(), usuario));
    }

    @GetMapping("/aberta")
    public SessaoCaixaResponseDTO consultar(@PathVariable Long caixaId, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.consultarAberta(caixaId, usuario.empresaId());
    }

    @PostMapping("/{sessaoId}/fechar")
    public SessaoCaixaResponseDTO fechar(@PathVariable Long caixaId, @PathVariable Long sessaoId,
            @Valid @RequestBody FechamentoCaixaDTO request, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.fechar(caixaId, sessaoId, request.saldoFinal(), usuario);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<String> tratar(ResponseStatusException erro) {
        return ResponseEntity.status(erro.getStatusCode()).body(erro.getReason());
    }
}
