package br.com.novexa.erp.controller;

import br.com.novexa.erp.service.EmpresaGeocodificacaoService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/empresas/geocodificacao")
public class EmpresaGeocodificacaoController {
    public record Consulta(@NotBlank @Size(max = 500) String endereco) { }
    private final EmpresaGeocodificacaoService service;
    public EmpresaGeocodificacaoController(EmpresaGeocodificacaoService service) { this.service = service; }

    @GetMapping("/status")
    public Map<String, Boolean> status() { return Map.of("configurado", service.configurado()); }

    @PostMapping
    public List<EmpresaGeocodificacaoService.Coordenada> buscar(@Valid @RequestBody Consulta consulta) {
        return service.buscar(consulta.endereco());
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<String> erro(ResponseStatusException e) { return ResponseEntity.status(e.getStatusCode()).body(e.getReason()); }
}
