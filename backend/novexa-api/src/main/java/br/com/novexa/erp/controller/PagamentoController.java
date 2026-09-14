package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.PagamentoResponseDTO;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.PagamentoService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@RestController
@RequestMapping("/vendas/{vendaId}/pagamentos")
public class PagamentoController {
    private final PagamentoService service;

    public PagamentoController(PagamentoService service) { this.service = service; }

    @GetMapping
    public List<PagamentoResponseDTO> listar(@PathVariable Long vendaId,
            @AuthenticationPrincipal UsuarioAutenticado autenticado) {
        return service.listarPorVenda(vendaId, autenticado.empresaId());
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<String> tratarRegra(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(e.getReason());
    }
}
