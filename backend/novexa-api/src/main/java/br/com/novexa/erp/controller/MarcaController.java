package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.MarcaService;
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.sql.SQLException;

@RestController
@RequestMapping("/produtos/marcas")
public class MarcaController {
    private final MarcaService service;
    public MarcaController(MarcaService service) { this.service = service; }

    @GetMapping
    public PaginaResponseDTO<MarcaResponseDTO> listar(@RequestParam(required = false) String termo,
            @RequestParam(required = false) Boolean ativo, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size, @RequestParam(defaultValue = "nome,asc") String sort,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.listar(usuario.empresaId(), termo, ativo, page, size, sort);
    }
    @GetMapping("/{id}")
    public MarcaResponseDTO consultar(@PathVariable Long id, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.consultar(id, usuario.empresaId());
    }
    @PostMapping
    public ResponseEntity<MarcaResponseDTO> criar(@Valid @RequestBody MarcaRequestDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.salvar(null, usuario.empresaId(), pedido));
    }
    @PutMapping("/{id}")
    public MarcaResponseDTO atualizar(@PathVariable Long id, @Valid @RequestBody MarcaRequestDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.salvar(id, usuario.empresaId(), pedido);
    }
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable Long id, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        service.excluir(id, usuario.empresaId()); return ResponseEntity.noContent().build();
    }
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<String> conflitoConcorrente(DataIntegrityViolationException erro) {
        if (erro.getMostSpecificCause() instanceof SQLException sql) {
            if ("23505".equals(sql.getSQLState())) return ResponseEntity.status(HttpStatus.CONFLICT).body("Já existe uma marca com este nome nesta empresa. Atualize a consulta.");
            if ("23503".equals(sql.getSQLState())) return ResponseEntity.status(HttpStatus.CONFLICT).body("Marca possui produtos vinculados. Inative a marca para preservar os vínculos.");
        }
        throw erro;
    }
}
