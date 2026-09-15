package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.CaixaOperacionalService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@RestController
@RequestMapping("/financeiro/caixas/sessoes")
public class CaixaOperacionalController {
    private final CaixaOperacionalService service;
    public CaixaOperacionalController(CaixaOperacionalService service) { this.service = service; }

    @GetMapping("/abertas")
    public List<SessaoCaixaAbertaDTO> abertas(@AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.abertas(usuario.empresaId());
    }
    @GetMapping("/{sessaoId}/resumo")
    public ResumoSessaoCaixaDTO resumo(@PathVariable Long sessaoId, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.resumo(sessaoId, usuario.empresaId());
    }
    @GetMapping("/{sessaoId}/movimentacoes")
    public List<MovimentacaoCaixaResponseDTO> movimentos(@PathVariable Long sessaoId, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.listarMovimentos(sessaoId, usuario.empresaId());
    }
    @PostMapping("/{sessaoId}/movimentacoes")
    public MovimentacaoCaixaResponseDTO movimentar(@PathVariable Long sessaoId,
            @Valid @RequestBody MovimentacaoCaixaRequestDTO pedido, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.movimentar(sessaoId, pedido, usuario);
    }
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<String> erro(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(e.getReason());
    }
}
