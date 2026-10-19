package br.com.novexa.erp.controller;

import br.com.novexa.erp.service.CepService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/enderecos/cep")
public class CepController {
    private final CepService service;
    public CepController(CepService service) { this.service = service; }

    @GetMapping("/{cep}")
    public CepService.Endereco buscar(@PathVariable String cep) { return service.buscar(cep); }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<String> erro(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(e.getReason());
    }
}
