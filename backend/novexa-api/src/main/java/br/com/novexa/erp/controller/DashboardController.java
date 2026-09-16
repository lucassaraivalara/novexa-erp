package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.DashboardResumoDTO;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.DashboardService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/dashboard")
public class DashboardController {
    private final DashboardService service;

    public DashboardController(DashboardService service) {
        this.service = service;
    }

    @GetMapping("/resumo")
    public DashboardResumoDTO resumo(@AuthenticationPrincipal UsuarioAutenticado autenticado) {
        return service.resumo(autenticado.empresaId());
    }
}
