package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.ProdutoRequestDTO;
import br.com.novexa.erp.dto.ProdutoResponseDTO;
import br.com.novexa.erp.entity.ProdutoEntity;
import br.com.novexa.erp.mapper.ProdutoMapper;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.ProdutoService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/produtos")
public class ProdutoController {

    private final ProdutoService produtoService;
    private final ProdutoMapper produtoMapper;

    public ProdutoController(
            ProdutoService produtoService,
            ProdutoMapper produtoMapper) {

        this.produtoService = produtoService;
        this.produtoMapper = produtoMapper;
    }

    @PostMapping
    public ResponseEntity<ProdutoResponseDTO> salvar(
            @Valid @RequestBody ProdutoRequestDTO request,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        ProdutoEntity produto = produtoMapper.toEntity(request);
        ProdutoEntity produtoSalvo = produtoService.salvar(produto, usuario.empresaId());

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(produtoMapper.toResponse(produtoSalvo));
    }

    @GetMapping
    public ResponseEntity<List<ProdutoResponseDTO>> listar(
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        List<ProdutoResponseDTO> produtos = produtoService.listar(usuario.empresaId())
                .stream()
                .map(produtoMapper::toResponse)
                .toList();

        return ResponseEntity.ok(produtos);
    }

    @GetMapping("/buscar")
    public ResponseEntity<List<ProdutoResponseDTO>> buscarPorTermo(
            @AuthenticationPrincipal UsuarioAutenticado usuario,
            @RequestParam String termo) {

        List<ProdutoResponseDTO> produtos = produtoService.buscarPorTermo(usuario.empresaId(), termo)
                .stream()
                .map(produtoMapper::toResponse)
                .toList();

        return ResponseEntity.ok(produtos);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProdutoResponseDTO> buscarPorId(
            @PathVariable Long id,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        ProdutoEntity produto = produtoService.buscarPorId(id, usuario.empresaId());
        return ResponseEntity.ok(produtoMapper.toResponse(produto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProdutoResponseDTO> atualizar(
            @PathVariable Long id,
            @Valid @RequestBody ProdutoRequestDTO request,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        ProdutoEntity dadosNovos = produtoMapper.toEntity(request);
        ProdutoEntity produtoAtualizado = produtoService.atualizar(
                id,
                dadosNovos,
                usuario.empresaId()
        );

        return ResponseEntity.ok(produtoMapper.toResponse(produtoAtualizado));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> inativar(
            @PathVariable Long id,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        produtoService.inativar(id, usuario.empresaId());
        return ResponseEntity.noContent().build();
    }
}
