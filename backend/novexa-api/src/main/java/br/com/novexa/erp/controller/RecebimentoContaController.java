package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.RecebimentoContaService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/financeiro/recebimentos-contas")
public class RecebimentoContaController {
    private final RecebimentoContaService service;
    public RecebimentoContaController(RecebimentoContaService service) { this.service = service; }

    @GetMapping("/resumo")
    public List<RecebimentoContaResumoDTO> resumo(@AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.resumir(usuario.empresaId());
    }

    @GetMapping
    public PaginaResponseDTO<RecebimentoContaDTO> listar(@AuthenticationPrincipal UsuarioAutenticado usuario,
            @RequestParam(required = false) Long contaId,
            @RequestParam(defaultValue = "false") boolean semDestino,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "dataHora,desc") String sort) {
        return service.listar(usuario.empresaId(), contaId, semDestino, status, page, size, sort);
    }
}
