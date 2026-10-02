package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.EntradaMercadoriaService;
import br.com.novexa.erp.service.EntradaXmlService;
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.time.LocalDate;

@RestController
@RequestMapping("/estoque/entradas")
public class EntradaMercadoriaController {
    private final EntradaMercadoriaService service;
    private final EntradaXmlService xml;
    public EntradaMercadoriaController(EntradaMercadoriaService service, EntradaXmlService xml) { this.service = service; this.xml = xml; }
    @PostMapping(value = "/importar-xml", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public EntradaXmlPreviewDTO preview(@RequestPart("arquivo") MultipartFile arquivo,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return xml.preview(arquivo, usuario.empresaId());
    }
    @PostMapping("/from-xml")
    public ResponseEntity<EntradaMercadoriaResponseDTO> criarXml(@Valid @RequestBody EntradaMercadoriaRequestDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return ResponseEntity.status(201).body(service.criarXml(pedido, usuario));
    }
    @PostMapping
    public ResponseEntity<EntradaMercadoriaResponseDTO> criar(@Valid @RequestBody EntradaMercadoriaRequestDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return ResponseEntity.status(201).body(service.criar(pedido, usuario));
    }
    @GetMapping("/{id}")
    public EntradaMercadoriaResponseDTO buscar(@PathVariable Long id, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.buscar(id, usuario.empresaId());
    }
    @PutMapping("/{id}")
    public EntradaMercadoriaResponseDTO editar(@PathVariable Long id, @Valid @RequestBody EntradaMercadoriaRequestDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) { return service.editar(id, pedido, usuario); }
    @PostMapping("/{id}/confirmar")
    public EntradaMercadoriaResponseDTO confirmar(@PathVariable Long id, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.confirmar(id, usuario);
    }
    @PostMapping("/{id}/cancelar")
    public EntradaMercadoriaResponseDTO cancelar(@PathVariable Long id, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.cancelar(id, usuario);
    }
    @GetMapping
    public PaginaResponseDTO<EntradaMercadoriaResponseDTO> listar(@AuthenticationPrincipal UsuarioAutenticado usuario,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "dataEntrada,desc") String sort, @RequestParam(required = false) String termo,
            @RequestParam(required = false) StatusEntradaMercadoria status, @RequestParam(required = false) OrigemEntradaMercadoria origem,
            @RequestParam(required = false) Long fornecedorId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicial,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFinal) {
        return service.listar(usuario.empresaId(), termo, status, origem, fornecedorId, dataInicial, dataFinal, page, size, sort);
    }
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<String> conflitoIntegridade() {
        return ResponseEntity.status(409).body("Entrada duplicada ou vinculo inconsistente. Revise nota, serie e chave NF-e.");
    }
}
