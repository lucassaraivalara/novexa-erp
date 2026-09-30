package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.ContaPagarService;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@RestController
@RequestMapping("/financeiro/contas-pagar")
public class ContaPagarController {
    private final ContaPagarService service;

    public ContaPagarController(ContaPagarService service) { this.service = service; }

    @GetMapping
    public List<ContaPagarResponseDTO> listar(@AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.listar(usuario.empresaId());
    }

    @PostMapping
    public ResponseEntity<ContaPagarResponseDTO> criar(@Valid @RequestBody ContaPagarRequestDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.criar(usuario.empresaId(), pedido));
    }

    @PutMapping("/{id}")
    public ContaPagarResponseDTO editar(@PathVariable Long id, @Valid @RequestBody ContaPagarRequestDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.editar(id, usuario.empresaId(), pedido);
    }

    @PostMapping("/{id}/pagar")
    public ContaPagarResponseDTO pagar(@PathVariable Long id, @Valid @RequestBody PagamentoContaPagarRequestDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.pagar(id, usuario.empresaId(), usuario.usuarioId(), pedido);
    }

    @PostMapping("/{id}/cancelar")
    public ContaPagarResponseDTO cancelar(@PathVariable Long id, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.cancelar(id, usuario.empresaId());
    }

    @PostMapping("/{id}/estornar")
    public ContaPagarResponseDTO estornar(@PathVariable Long id, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.estornar(id, usuario.empresaId(), usuario.usuarioId());
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<String> erro(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(e.getReason());
    }
}
