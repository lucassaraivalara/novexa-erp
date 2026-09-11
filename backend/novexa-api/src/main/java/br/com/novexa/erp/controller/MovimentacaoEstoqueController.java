package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.MovimentacaoEstoqueRequestDTO;
import br.com.novexa.erp.dto.MovimentacaoEstoqueResponseDTO;
import br.com.novexa.erp.entity.OrigemMovimentacaoEstoque;
import br.com.novexa.erp.entity.TipoMovimentacaoEstoque;
import br.com.novexa.erp.mapper.MovimentacaoEstoqueMapper;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.MovimentacaoEstoqueService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/estoque/movimentacoes")
public class MovimentacaoEstoqueController {

    private final MovimentacaoEstoqueService service;
    private final MovimentacaoEstoqueMapper mapper;

    public MovimentacaoEstoqueController(
            MovimentacaoEstoqueService service,
            MovimentacaoEstoqueMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    @PostMapping("/entrada")
    public ResponseEntity<MovimentacaoEstoqueResponseDTO> entrada(
            @Valid @RequestBody MovimentacaoEstoqueRequestDTO request,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        var movimentacao = service.movimentar(
                usuario.empresaId(),
                request.getProdutoId(),
                usuario.usuarioId(),
                TipoMovimentacaoEstoque.ENTRADA,
                OrigemMovimentacaoEstoque.MANUAL,
                request.getQuantidade(),
                request.getMotivo()
        );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(mapper.toResponse(movimentacao));
    }

    @PostMapping("/saida")
    public ResponseEntity<MovimentacaoEstoqueResponseDTO> saida(
            @Valid @RequestBody MovimentacaoEstoqueRequestDTO request,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        var movimentacao = service.movimentar(
                usuario.empresaId(),
                request.getProdutoId(),
                usuario.usuarioId(),
                TipoMovimentacaoEstoque.SAIDA,
                OrigemMovimentacaoEstoque.MANUAL,
                request.getQuantidade(),
                request.getMotivo()
        );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(mapper.toResponse(movimentacao));
    }

    @PostMapping("/ajuste")
    public ResponseEntity<MovimentacaoEstoqueResponseDTO> ajuste(
            @Valid @RequestBody MovimentacaoEstoqueRequestDTO request,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        var movimentacao = service.movimentar(
                usuario.empresaId(),
                request.getProdutoId(),
                usuario.usuarioId(),
                TipoMovimentacaoEstoque.AJUSTE,
                OrigemMovimentacaoEstoque.AJUSTE,
                request.getQuantidade(),
                request.getMotivo()
        );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(mapper.toResponse(movimentacao));
    }

    @GetMapping("/produto/{produtoId}")
    public ResponseEntity<List<MovimentacaoEstoqueResponseDTO>> historicoPorProduto(
            @PathVariable Long produtoId,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        var movimentacoes = service.buscarPorProduto(usuario.empresaId(), produtoId);

        var response = movimentacoes.stream()
                .map(mapper::toResponse)
                .toList();

        return ResponseEntity.ok(response);
    }
}