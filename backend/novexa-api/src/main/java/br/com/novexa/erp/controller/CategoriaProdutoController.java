package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.CategoriaProdutoService;
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.sql.SQLException;

@RestController
@RequestMapping("/produtos")
public class CategoriaProdutoController {
    private final CategoriaProdutoService service;
    public CategoriaProdutoController(CategoriaProdutoService service) { this.service = service; }

    @GetMapping("/categorias")
    public PaginaResponseDTO<CategoriaProdutoResponseDTO> listar(@RequestParam(required = false) String termo,
            @RequestParam(required = false) Boolean ativo, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size, @RequestParam(defaultValue = "nome,asc") String sort,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.listar(usuario.empresaId(), termo, ativo, page, size, sort);
    }
    @GetMapping("/categorias/{id}")
    public CategoriaProdutoResponseDTO consultar(@PathVariable Long id, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.consultar(id, usuario.empresaId());
    }
    @PostMapping("/categorias")
    public ResponseEntity<CategoriaProdutoResponseDTO> criar(@Valid @RequestBody CategoriaProdutoRequestDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.salvar(null, usuario.empresaId(), pedido));
    }
    @PutMapping("/categorias/{id}")
    public CategoriaProdutoResponseDTO atualizar(@PathVariable Long id, @Valid @RequestBody CategoriaProdutoRequestDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.salvar(id, usuario.empresaId(), pedido);
    }
    @DeleteMapping("/categorias/{id}")
    public ResponseEntity<Void> excluir(@PathVariable Long id, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        service.excluir(id, usuario.empresaId()); return ResponseEntity.noContent().build();
    }

    @GetMapping("/subcategorias")
    public PaginaResponseDTO<SubcategoriaProdutoResponseDTO> listarSubcategorias(@RequestParam(required = false) String termo,
            @RequestParam(required = false) Boolean ativo, @RequestParam(required = false) Long categoriaId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "nome,asc") String sort, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.listarSubcategorias(usuario.empresaId(), termo, ativo, categoriaId, page, size, sort);
    }
    @GetMapping("/subcategorias/{id}")
    public SubcategoriaProdutoResponseDTO consultarSubcategoria(@PathVariable Long id, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.consultarSubcategoria(id, usuario.empresaId());
    }
    @PostMapping("/subcategorias")
    public ResponseEntity<SubcategoriaProdutoResponseDTO> criarSubcategoria(@Valid @RequestBody SubcategoriaProdutoRequestDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.salvarSubcategoria(null, usuario.empresaId(), pedido));
    }
    @PutMapping("/subcategorias/{id}")
    public SubcategoriaProdutoResponseDTO atualizarSubcategoria(@PathVariable Long id, @Valid @RequestBody SubcategoriaProdutoRequestDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.salvarSubcategoria(id, usuario.empresaId(), pedido);
    }
    @DeleteMapping("/subcategorias/{id}")
    public ResponseEntity<Void> excluirSubcategoria(@PathVariable Long id, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        service.excluirSubcategoria(id, usuario.empresaId()); return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<String> conflitoConcorrente(DataIntegrityViolationException erro) {
        if (erro.getMostSpecificCause() instanceof SQLException sql) {
            if ("23505".equals(sql.getSQLState())) return ResponseEntity.status(HttpStatus.CONFLICT).body("Nome já utilizado nesta empresa. Atualize a consulta.");
            if ("23503".equals(sql.getSQLState())) return ResponseEntity.status(HttpStatus.CONFLICT).body("Cadastro possui vínculo ou a categoria não está mais disponível. Atualize a consulta.");
        }
        throw erro;
    }
}
