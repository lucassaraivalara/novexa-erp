package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.AnaliseVendasDTO.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.AnaliseVendasService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.http.HttpHeaders;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/vendas/analise")
public class AnaliseVendasController {
    private final AnaliseVendasService service;
    public AnaliseVendasController(AnaliseVendasService service) { this.service = service; }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<String> tratarRegra(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(e.getReason());
    }

    @GetMapping("/resumo")
    public Resumo resumo(@AuthenticationPrincipal UsuarioAutenticado usuario,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicial,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFinal) {
        return service.resumo(usuario.empresaId(), dataInicial, dataFinal);
    }

    @GetMapping("/produtos")
    public Ranking produtos(@AuthenticationPrincipal UsuarioAutenticado usuario,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicial,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFinal,
            @RequestParam(defaultValue = "valor") String ordem, @RequestParam(required = false) String unidade,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "5") int size) {
        return service.produtos(usuario.empresaId(), dataInicial, dataFinal, ordem, unidade, page, size);
    }

    @GetMapping("/categorias")
    public Distribuicao categorias(@AuthenticationPrincipal UsuarioAutenticado usuario,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicial,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFinal) {
        return service.categorias(usuario.empresaId(), dataInicial, dataFinal);
    }

    @GetMapping("/exportar")
    public ResponseEntity<byte[]> exportar(@AuthenticationPrincipal UsuarioAutenticado usuario,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicial,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFinal,
            @RequestParam String secao, @RequestParam(defaultValue = "valor") String ordem,
            @RequestParam(required = false) String unidade) {
        byte[] csv = service.exportar(usuario.empresaId(), dataInicial, dataFinal, secao, ordem, unidade);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=analise-" + secao + "-" + dataInicial + "-" + dataFinal + ".csv")
                .body(csv);
    }
}
