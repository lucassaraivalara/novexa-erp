package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.BancoRequestDTO;
import br.com.novexa.erp.dto.BancoResponseDTO;
import br.com.novexa.erp.service.BancoService;
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
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/financeiro/bancos")
public class BancoController {

    private final BancoService service;

    public BancoController(BancoService service) {
        this.service = service;
    }

    @GetMapping
    public List<BancoResponseDTO> listar() {
        return service.listar();
    }

    @PostMapping
    public ResponseEntity<BancoResponseDTO> criar(@Valid @RequestBody BancoRequestDTO pedido) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.criar(pedido));
    }

    @PutMapping("/{id}")
    public BancoResponseDTO atualizar(
            @PathVariable Long id,
            @Valid @RequestBody BancoRequestDTO pedido) {
        return service.atualizar(id, pedido);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<String> tratarRegra(ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode()).body(exception.getReason());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<String> tratarDuplicidade() {
        return ResponseEntity.status(HttpStatus.CONFLICT).body("Numero ja utilizado por outro banco.");
    }
}
