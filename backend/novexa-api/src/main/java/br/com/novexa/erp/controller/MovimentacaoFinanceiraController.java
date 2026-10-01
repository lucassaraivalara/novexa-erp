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
@RequestMapping("/financeiro/movimentacoes-financeiras")
public class MovimentacaoFinanceiraController {
    private final ContaFinanceiraService service;
    public MovimentacaoFinanceiraController(ContaFinanceiraService service) { this.service = service; }

    @GetMapping
    public br.com.novexa.erp.dto.PaginaResponseDTO<MovimentacaoFinanceiraResponseDTO> listar(
            @RequestParam(required = false) Long contaFinanceiraId,
            @RequestParam(required = false) br.com.novexa.erp.entity.TipoMovimentacaoFinanceira tipo,
            @RequestParam(required = false) br.com.novexa.erp.entity.OrigemMovimentacaoFinanceira origem,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate dataInicial,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate dataFinal,
            @RequestParam(required = false) Boolean estornada,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "dataMovimento,desc") String sort,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.listarMovimentosPagina(usuario.empresaId(), contaFinanceiraId, tipo, origem, dataInicial, dataFinal, estornada, page, size, sort);
    }

    @PostMapping
    public ResponseEntity<MovimentacaoFinanceiraResponseDTO> criar(@Valid @RequestBody MovimentacaoFinanceiraCriacaoDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.criarMovimento(usuario.empresaId(), usuario.usuarioId(), pedido));
    }

    @PatchMapping("/{id}/estorno")
    public MovimentacaoFinanceiraResponseDTO estornar(@PathVariable Long id,
            @Valid @RequestBody MovimentacaoFinanceiraEstornoDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.estornar(id, usuario.empresaId(), usuario.usuarioId(), pedido);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<String> erro(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(e.getReason());
    }
}
