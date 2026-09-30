package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.TransferenciaFinanceiraService;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@RestController
@RequestMapping("/financeiro/transferencias")
public class TransferenciaFinanceiraController {
    private final TransferenciaFinanceiraService service;
    public TransferenciaFinanceiraController(TransferenciaFinanceiraService service) { this.service = service; }

    @PostMapping
    public TransferenciaFinanceiraResponseDTO criar(@Valid @RequestBody TransferenciaFinanceiraCriacaoDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.criar(usuario.empresaId(), usuario.usuarioId(), pedido);
    }

    @GetMapping
    public List<TransferenciaFinanceiraResponseDTO> listar(@AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.listar(usuario.empresaId());
    }

    @PostMapping("/{id}/estornar")
    public TransferenciaFinanceiraResponseDTO estornar(@PathVariable Long id,
            @Valid @RequestBody MovimentacaoFinanceiraEstornoDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.estornar(id, usuario.empresaId(), usuario.usuarioId(), pedido);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<String> erro(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(e.getReason());
    }
}
