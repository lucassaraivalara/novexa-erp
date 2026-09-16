package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.AgenciaRequestDTO;
import br.com.novexa.erp.dto.AgenciaResponseDTO;
import br.com.novexa.erp.service.AgenciaService;
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/financeiro/agencias")
public class AgenciaController {

    private final AgenciaService service;

    public AgenciaController(AgenciaService service) {
        this.service = service;
    }

    @GetMapping
    public List<AgenciaResponseDTO> listar(
            @RequestParam(required = false) Long bancoId) {
        return service.listar(bancoId);
    }

    @PostMapping
    public ResponseEntity<AgenciaResponseDTO> criar(@Valid @RequestBody AgenciaRequestDTO pedido) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.criar(pedido));
    }

    @PutMapping("/{id}")
    public AgenciaResponseDTO atualizar(
            @PathVariable Long id,
            @Valid @RequestBody AgenciaRequestDTO pedido) {
        return service.atualizar(id, pedido);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<String> tratarRegra(ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode()).body(exception.getReason());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<String> tratarDuplicidade() {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body("Numero de agencia ja utilizado para este banco.");
    }
}
