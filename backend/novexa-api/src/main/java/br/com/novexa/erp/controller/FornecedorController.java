package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.FornecedorRequestDTO;
import br.com.novexa.erp.dto.FornecedorResponseDTO;
import br.com.novexa.erp.entity.FornecedorEntity;
import br.com.novexa.erp.mapper.FornecedorMapper;
import br.com.novexa.erp.service.FornecedorService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
            @Valid @RequestBody FornecedorRequestDTO request) {

        FornecedorEntity fornecedor = fornecedorMapper.toEntity(request);
        FornecedorEntity fornecedorSalvo = fornecedorService.salvar(
                fornecedor,
                request.getEmpresaId()
        );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(fornecedorMapper.toResponse(fornecedorSalvo));
    }

    @GetMapping
    public ResponseEntity<List<FornecedorResponseDTO>> listar(
            @RequestParam Long empresaId) {

        List<FornecedorResponseDTO> fornecedores = fornecedorService.listar(empresaId)
                .stream()
                .map(fornecedorMapper::toResponse)
                .toList();

        return ResponseEntity.ok(fornecedores);
    }

    @GetMapping("/{id}")
    public ResponseEntity<FornecedorResponseDTO> buscarPorId(
            @PathVariable Long id,
            @RequestParam Long empresaId) {

        FornecedorEntity fornecedor = fornecedorService.buscarPorId(id, empresaId);
        return ResponseEntity.ok(fornecedorMapper.toResponse(fornecedor));
    }

    @PutMapping("/{id}")
    public ResponseEntity<FornecedorResponseDTO> atualizar(
            @PathVariable Long id,
            @Valid @RequestBody FornecedorRequestDTO request) {

        FornecedorEntity dadosNovos = fornecedorMapper.toEntity(request);
        FornecedorEntity fornecedorAtualizado = fornecedorService.atualizar(
                id,
                dadosNovos,
                request.getEmpresaId()
        );

        return ResponseEntity.ok(fornecedorMapper.toResponse(fornecedorAtualizado));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> inativar(
            @PathVariable Long id,
            @RequestParam Long empresaId) {

        fornecedorService.inativar(id, empresaId);
        return ResponseEntity.noContent().build();
    }
}
