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

    @GetMapping("/pagina")
    public PaginaResponseDTO<ContaFinanceiraResponseDTO> listarPagina(
            @AuthenticationPrincipal UsuarioAutenticado usuario,
            @RequestParam(required = false) String termo,
            @RequestParam(required = false) Boolean ativo,
            @RequestParam(required = false) br.com.novexa.erp.entity.TipoContaFinanceira tipo,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "nome,asc") String sort) {
        return service.listarContasPagina(usuario.empresaId(), termo, ativo, tipo, page, size, sort);
    }

    @GetMapping("/resumo")
    public List<ContaFinanceiraResumoDTO> resumo(@AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.resumirContas(usuario.empresaId());
    }

    @PostMapping
    public ResponseEntity<ContaFinanceiraResponseDTO> criar(@Valid @RequestBody ContaFinanceiraCriacaoDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.criarConta(usuario.empresaId(), usuario.usuarioId(), pedido));
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
