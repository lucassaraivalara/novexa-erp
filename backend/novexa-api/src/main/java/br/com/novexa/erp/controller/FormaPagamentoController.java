package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.service.FormaPagamentoService;
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@RestController
@RequestMapping("/financeiro/formas-pagamento")
public class FormaPagamentoController {
    private final FormaPagamentoService service;
    public FormaPagamentoController(FormaPagamentoService service) { this.service = service; }

    @GetMapping
    public List<FormaPagamentoResponseDTO> listar() { return service.listar(); }

    @GetMapping("/{id}")
    public FormaPagamentoResponseDTO buscar(@PathVariable Long id) { return service.buscar(id); }

    @PostMapping
    public ResponseEntity<FormaPagamentoResponseDTO> criar(@Valid @RequestBody FormaPagamentoRequestDTO pedido) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.criar(pedido));
    }

    @PutMapping("/{id}")
    public FormaPagamentoResponseDTO atualizar(@PathVariable Long id, @Valid @RequestBody FormaPagamentoRequestDTO pedido) {
        return service.atualizar(id, pedido);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<String> tratarRegra(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(e.getReason());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<String> tratarDuplicidade() {
        return ResponseEntity.status(HttpStatus.CONFLICT).body("Descrição já utilizada por outra forma de pagamento.");
    }
}
