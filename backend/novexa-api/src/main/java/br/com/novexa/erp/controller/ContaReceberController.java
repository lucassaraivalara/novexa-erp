package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.ContaReceberService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;

@RestController
@RequestMapping("/financeiro/contas-receber")
public class ContaReceberController {
    private final ContaReceberService service;
    public ContaReceberController(ContaReceberService service) { this.service = service; }

    @PostMapping
    public ResponseEntity<ContaReceberResponseDTO> criar(@Valid @RequestBody ContaReceberRequestDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.criar(usuario.empresaId(), pedido));
    }
    @GetMapping("/pagina")
    public PaginaResponseDTO<ContaReceberResponseDTO> listar(
            @RequestParam(required = false) String termo, @RequestParam(required = false) StatusContaReceber status,
            @RequestParam(required = false) Long clienteId, @RequestParam(required = false) OrigemContaReceber origem,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate vencimentoDe,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate vencimentoAte,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "dataVencimento,asc") String sort, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.listarPagina(usuario.empresaId(), termo, status, clienteId, vencimentoDe, vencimentoAte, origem, page, size, sort);
    }
    @GetMapping("/resumo")
    public ResumoContasReceberDTO resumo(@AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.resumo(usuario.empresaId());
    }
    @GetMapping("/{id}")
    public ContaReceberResponseDTO buscar(@PathVariable Long id, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.buscar(id, usuario.empresaId());
    }
    @PutMapping("/{id}")
    public ContaReceberResponseDTO editar(@PathVariable Long id, @Valid @RequestBody ContaReceberRequestDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.editar(id, usuario.empresaId(), pedido);
    }
    @PostMapping("/{id}/receber")
    public ContaReceberResponseDTO receber(@PathVariable Long id, @Valid @RequestBody ContaReceberBaixaDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.receber(id, usuario.empresaId(), usuario.usuarioId(), pedido);
    }
    @PostMapping("/{id}/recebimentos/{movimentacaoId}/estornar")
    public ContaReceberResponseDTO estornar(@PathVariable Long id, @PathVariable Long movimentacaoId,
            @Valid @RequestBody MovimentacaoFinanceiraEstornoDTO pedido, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.estornar(id, movimentacaoId, usuario.empresaId(), usuario.usuarioId(), pedido);
    }
    @PostMapping("/{id}/cancelar")
    public ContaReceberResponseDTO cancelar(@PathVariable Long id, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.cancelar(id, usuario.empresaId());
    }
    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<String> conflitoDeIntegridade() {
        return ResponseEntity.status(HttpStatus.CONFLICT).body("Conflito nos dados financeiros ou chave de requisicao ja utilizada.");
    }
}
