package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.PagamentoResponseDTO;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.ConfirmacaoPagamentoPixService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/financeiro/pagamentos")
public class ConfirmacaoPagamentoPixController {
    private final ConfirmacaoPagamentoPixService service;
    public ConfirmacaoPagamentoPixController(ConfirmacaoPagamentoPixService service) { this.service = service; }

    @PostMapping("/{id}/confirmar-recebimento")
    public PagamentoResponseDTO confirmar(@PathVariable Long id, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.confirmar(id, usuario.empresaId(), usuario.usuarioId());
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<String> regra(ResponseStatusException e) { return ResponseEntity.status(e.getStatusCode()).body(e.getReason()); }
}
