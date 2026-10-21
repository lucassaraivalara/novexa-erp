package br.com.novexa.erp.controller;
import br.com.novexa.erp.dto.ConfiguracaoRecebimentosDTO;
import br.com.novexa.erp.service.ConfiguracaoRecebimentosService;
import br.com.novexa.erp.security.UsuarioAutenticado;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
@RestController
@RequestMapping("/financeiro/configuracoes/recebimentos")
public class ConfiguracaoRecebimentosController {
    private final ConfiguracaoRecebimentosService service;
    public ConfiguracaoRecebimentosController(ConfiguracaoRecebimentosService service) { this.service=service; }
    @GetMapping public ConfiguracaoRecebimentosDTO consultar(@AuthenticationPrincipal UsuarioAutenticado usuario) { return service.consultar(usuario.empresaId()); }
    @PutMapping public ConfiguracaoRecebimentosDTO alterar(@Valid @RequestBody ConfiguracaoRecebimentosDTO pedido,@AuthenticationPrincipal UsuarioAutenticado usuario) { return service.alterar(pedido,usuario); }
}
