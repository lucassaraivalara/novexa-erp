package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.FornecedorRequestDTO;
import br.com.novexa.erp.dto.FornecedorResponseDTO;
import br.com.novexa.erp.dto.FornecedorBuscaResponseDTO;
import br.com.novexa.erp.dto.PaginaResponseDTO;
import br.com.novexa.erp.entity.FornecedorEntity;
import br.com.novexa.erp.mapper.FornecedorMapper;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.FornecedorService;
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
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;

@RestController
@RequestMapping("/fornecedores")
public class FornecedorController {

    private final FornecedorService fornecedorService;
    private final FornecedorMapper fornecedorMapper;

    public FornecedorController(
            FornecedorService fornecedorService,
            FornecedorMapper fornecedorMapper) {

        this.fornecedorService = fornecedorService;
        this.fornecedorMapper = fornecedorMapper;
    }

    @PostMapping
    public ResponseEntity<FornecedorResponseDTO> salvar(
            @Valid @RequestBody FornecedorRequestDTO request,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        FornecedorEntity fornecedor = fornecedorMapper.toEntity(request);
        FornecedorEntity fornecedorSalvo = fornecedorService.salvar(
                fornecedor,
                usuario.empresaId()
        );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(fornecedorMapper.toResponse(fornecedorSalvo));
    }

    @GetMapping
    public PaginaResponseDTO<FornecedorResponseDTO> listar(
            @RequestParam(required = false) String termo,
            @RequestParam(required = false) Boolean ativo,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "razaoSocial,asc") String sort,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return PaginaResponseDTO.de(fornecedorService.listarPagina(usuario.empresaId(), termo, ativo, page, size, sort),
                fornecedorMapper::toResponse);
    }

    @GetMapping("/buscar")
    public List<FornecedorBuscaResponseDTO> buscarPorTermo(
            @RequestParam(defaultValue = "") String termo,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return fornecedorService.buscarPorTermo(usuario.empresaId(), termo).stream().map(FornecedorBuscaResponseDTO::de).toList();
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<String> tratarConflito() {
        return ResponseEntity.status(HttpStatus.CONFLICT).body("CPF ou CNPJ ja cadastrado para um fornecedor desta empresa.");
    }

    @GetMapping("/{id}")
    public ResponseEntity<FornecedorResponseDTO> buscarPorId(
            @PathVariable Long id,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        FornecedorEntity fornecedor = fornecedorService.buscarPorId(id, usuario.empresaId());
        return ResponseEntity.ok(fornecedorMapper.toResponse(fornecedor));
    }

    @PutMapping("/{id}")
    public ResponseEntity<FornecedorResponseDTO> atualizar(
            @PathVariable Long id,
            @Valid @RequestBody FornecedorRequestDTO request,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        FornecedorEntity dadosNovos = fornecedorMapper.toEntity(request);
        FornecedorEntity fornecedorAtualizado = fornecedorService.atualizar(
                id,
                dadosNovos,
                usuario.empresaId()
        );

        return ResponseEntity.ok(fornecedorMapper.toResponse(fornecedorAtualizado));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> inativar(
            @PathVariable Long id,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        fornecedorService.inativar(id, usuario.empresaId());
        return ResponseEntity.noContent().build();
    }
}
