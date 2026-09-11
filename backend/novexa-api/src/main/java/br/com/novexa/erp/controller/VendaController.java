package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.VendaService;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/vendas")
public class VendaController {
    private final VendaService service;
    public VendaController(VendaService service) { this.service = service; }

    @PostMapping
    public ResponseEntity<VendaResponseDTO> finalizar(@Valid @RequestBody VendaRequestDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado autenticado) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.finalizar(pedido, autenticado));
    }

    @GetMapping("/{id}")
    public VendaResponseDTO buscar(@PathVariable Long id, @AuthenticationPrincipal UsuarioAutenticado autenticado) {
        return service.buscar(id, autenticado.empresaId());
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<String> tratarRegra(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(e.getReason());
    }
}
