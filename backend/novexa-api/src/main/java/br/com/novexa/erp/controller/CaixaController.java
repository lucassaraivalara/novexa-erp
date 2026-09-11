package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.CaixaRequestDTO;
import br.com.novexa.erp.dto.CaixaResponseDTO;
import br.com.novexa.erp.entity.CaixaEntity;
import br.com.novexa.erp.mapper.CaixaMapper;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.CaixaService;
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

import java.util.List;

@RestController
@RequestMapping("/financeiro/caixas")
public class CaixaController {

    private final CaixaService caixaService;
    private final CaixaMapper caixaMapper;

    public CaixaController(
            CaixaService caixaService,
            CaixaMapper caixaMapper) {

        this.caixaService = caixaService;
        this.caixaMapper = caixaMapper;
    }

    @PostMapping
    public ResponseEntity<CaixaResponseDTO> salvar(
            @Valid @RequestBody CaixaRequestDTO request,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        CaixaEntity caixa = caixaMapper.toEntity(request);
        CaixaEntity caixaSalvo = caixaService.salvar(caixa, usuario.empresaId());

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(caixaMapper.toResponse(caixaSalvo));
    }

    @GetMapping
    public ResponseEntity<List<CaixaResponseDTO>> listar(
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        List<CaixaResponseDTO> caixas = caixaService.listar(usuario.empresaId())
                .stream()
                .map(caixaMapper::toResponse)
                .toList();

        return ResponseEntity.ok(caixas);
    }

    @GetMapping("/{id}")
    public ResponseEntity<CaixaResponseDTO> buscarPorId(
            @PathVariable Long id,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        CaixaEntity caixa = caixaService.buscarPorId(id, usuario.empresaId());
        return ResponseEntity.ok(caixaMapper.toResponse(caixa));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CaixaResponseDTO> atualizar(
            @PathVariable Long id,
            @Valid @RequestBody CaixaRequestDTO request,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        CaixaEntity dadosNovos = caixaMapper.toEntity(request);
        CaixaEntity caixaAtualizado = caixaService.atualizar(
                id,
                dadosNovos,
                usuario.empresaId()
        );

        return ResponseEntity.ok(caixaMapper.toResponse(caixaAtualizado));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> inativar(
            @PathVariable Long id,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        caixaService.inativar(id, usuario.empresaId());
        return ResponseEntity.noContent().build();
    }
}
