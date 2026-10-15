package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.EntradaContaPagarService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;

@RestController
@RequestMapping("/estoque/entradas/{id}/conta-pagar")
public class EntradaContaPagarController {
    private final EntradaContaPagarService service;
    public EntradaContaPagarController(EntradaContaPagarService service) { this.service = service; }
    @GetMapping
    public ObrigacaoEntradaDTO consultar(@PathVariable Long id, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.consultar(id, usuario.empresaId());
    }
    @PostMapping("/gerar")
    public ObrigacaoEntradaDTO gerar(@PathVariable Long id, @Valid @RequestBody GerarContaPagarEntradaDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) { return service.gerar(id, pedido, usuario); }
    @PostMapping("/vincular")
    public ObrigacaoEntradaDTO vincular(@PathVariable Long id, @Valid @RequestBody VincularContaPagarEntradaDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) { return service.vincular(id, pedido.contaPagarId(), usuario); }
    @PostMapping("/desvincular")
    public ObrigacaoEntradaDTO desvincular(@PathVariable Long id, @Valid @RequestBody VincularContaPagarEntradaDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) { return service.desvincular(id, pedido.contaPagarId(), usuario); }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<String> conflitoVinculo() {
        return ResponseEntity.status(409).body("Vínculo já utilizado ou inconsistente. Atualize a entrada e consulte a obrigação.");
    }
}
