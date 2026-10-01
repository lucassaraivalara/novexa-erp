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
    public br.com.novexa.erp.dto.PaginaResponseDTO<TransferenciaFinanceiraResponseDTO> listar(
            @RequestParam(required = false) Long contaOrigemId,
            @RequestParam(required = false) Long contaDestinoId,
            @RequestParam(required = false) br.com.novexa.erp.entity.StatusTransferenciaFinanceira status,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate dataInicial,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate dataFinal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "dataMovimento,desc") String sort,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.listarPagina(usuario.empresaId(), contaOrigemId, contaDestinoId, status, dataInicial, dataFinal, page, size, sort);
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
