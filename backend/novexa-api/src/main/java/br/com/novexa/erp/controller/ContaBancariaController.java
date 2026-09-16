package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.ContaBancariaRequestDTO;
import br.com.novexa.erp.dto.ContaBancariaResponseDTO;
import br.com.novexa.erp.entity.TipoContaBancaria;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.ContaBancariaService;
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
@RequestMapping("/financeiro/contas-bancarias")
public class ContaBancariaController {

    private final ContaBancariaService service;

    public ContaBancariaController(ContaBancariaService service) {
        this.service = service;
    }

    @GetMapping
    public List<ContaBancariaResponseDTO> listar(
            @RequestParam(required = false) Long agenciaId,
            @RequestParam(required = false) Long bancoId,
            @RequestParam(required = false) TipoContaBancaria tipo,
            @RequestParam(required = false) Boolean ativo,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.listar(usuario.empresaId(), agenciaId, bancoId, tipo, ativo);
    }

    @PostMapping
    public ResponseEntity<ContaBancariaResponseDTO> criar(
            @Valid @RequestBody ContaBancariaRequestDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.criar(usuario.empresaId(), pedido));
    }

    @PutMapping("/{id}")
    public ContaBancariaResponseDTO atualizar(
            @PathVariable Long id,
            @Valid @RequestBody ContaBancariaRequestDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.atualizar(id, usuario.empresaId(), pedido);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<String> tratarRegra(ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode()).body(exception.getReason());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<String> tratarDuplicidade() {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body("Conta bancaria ja cadastrada para esta empresa e agencia.");
    }
}
