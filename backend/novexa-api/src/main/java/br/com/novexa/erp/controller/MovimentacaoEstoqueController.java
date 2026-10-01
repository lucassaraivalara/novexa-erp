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
import org.springframework.web.bind.annotation.RequestParam;

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
    public br.com.novexa.erp.dto.PaginaResponseDTO<MovimentacaoEstoqueResponseDTO> historicoPorProduto(
            @PathVariable Long produtoId,
            @RequestParam(required = false) TipoMovimentacaoEstoque tipo,
            @RequestParam(required = false) OrigemMovimentacaoEstoque origem,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate dataInicial,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate dataFinal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "dataHora,desc") String sort,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return br.com.novexa.erp.dto.PaginaResponseDTO.de(service.listarPagina(usuario.empresaId(), produtoId,
                tipo, origem, dataInicial, dataFinal, page, size, sort), mapper::toResponse);
    }
}
