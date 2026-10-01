package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.ConfiguracaoFormaPagamentoEmpresaService;
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@RestController
@RequestMapping("/financeiro/configuracoes-formas-pagamento")
public class ConfiguracaoFormaPagamentoEmpresaController {
    private final ConfiguracaoFormaPagamentoEmpresaService service;
    public ConfiguracaoFormaPagamentoEmpresaController(ConfiguracaoFormaPagamentoEmpresaService service) { this.service = service; }

    @GetMapping
    public List<ConfiguracaoFormaPagamentoEmpresaResponseDTO> listar(
            @RequestParam(defaultValue = "todas") String situacao, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.listar(usuario.empresaId(), situacao);
    }
    @GetMapping("/{id}")
    public ConfiguracaoFormaPagamentoEmpresaResponseDTO buscar(@PathVariable Long id, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.buscar(id, usuario.empresaId());
    }
    @PostMapping
    public ResponseEntity<ConfiguracaoFormaPagamentoEmpresaResponseDTO> criar(
            @Valid @RequestBody ConfiguracaoFormaPagamentoEmpresaRequestDTO p, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.criar(usuario.empresaId(), p));
    }
    @PutMapping("/{id}")
    public ConfiguracaoFormaPagamentoEmpresaResponseDTO atualizar(@PathVariable Long id,
            @Valid @RequestBody ConfiguracaoFormaPagamentoEmpresaRequestDTO p, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.atualizar(id, usuario.empresaId(), p);
    }
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<String> regra(ResponseStatusException e) { return ResponseEntity.status(e.getStatusCode()).body(e.getReason()); }
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<String> integridade() {
        return ResponseEntity.status(HttpStatus.CONFLICT).body("Nome já utilizado ou vínculo incompatível com a configuração.");
    }
}
