package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.ContaFinanceiraService;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@RestController
@RequestMapping("/financeiro/contas-financeiras")
public class ContaFinanceiraController {
    private final ContaFinanceiraService service;
    public ContaFinanceiraController(ContaFinanceiraService service) { this.service = service; }

    @GetMapping
    public List<ContaFinanceiraResponseDTO> listar(@AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.listarContas(usuario.empresaId());
    }

    @PostMapping
    public ResponseEntity<ContaFinanceiraResponseDTO> criar(@Valid @RequestBody ContaFinanceiraCriacaoDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.criarConta(usuario.empresaId(), pedido));
    }

    @PutMapping("/{id}")
    public ContaFinanceiraResponseDTO editar(@PathVariable Long id, @Valid @RequestBody ContaFinanceiraEdicaoDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.editarConta(id, usuario.empresaId(), pedido);
    }

    @PatchMapping("/{id}/situacao")
    public ContaFinanceiraResponseDTO situacao(@PathVariable Long id, @Valid @RequestBody ContaFinanceiraSituacaoDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.alterarSituacao(id, usuario.empresaId(), pedido);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<String> erro(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(e.getReason());
    }
}
