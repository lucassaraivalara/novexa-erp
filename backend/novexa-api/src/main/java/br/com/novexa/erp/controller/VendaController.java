package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.VendaService;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/vendas")
public class VendaController {
    private final VendaService service;
    private final br.com.novexa.erp.service.CancelamentoVendaService cancelamento;
    public VendaController(VendaService service, br.com.novexa.erp.service.CancelamentoVendaService cancelamento) {
        this.service = service; this.cancelamento = cancelamento;
    }

    @PostMapping("/{id}/cancelar")
    public VendaResponseDTO cancelar(@PathVariable Long id, @AuthenticationPrincipal UsuarioAutenticado autenticado) {
        return cancelamento.cancelarVendaFaturada(id, autenticado);
    }

    @PostMapping
    public ResponseEntity<VendaResponseDTO> finalizar(@Valid @RequestBody VendaRequestDTO pedido,
            @AuthenticationPrincipal UsuarioAutenticado autenticado) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.finalizar(pedido, autenticado));
    }

    @PostMapping("/abertas")
    public ResponseEntity<VendaResponseDTO> criarAberta(@AuthenticationPrincipal UsuarioAutenticado autenticado) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.criarVendaAberta(autenticado));
    }

    @PostMapping("/{id}/itens")
    public VendaResponseDTO adicionarItem(@PathVariable Long id, @Valid @RequestBody OperacaoVendaDTO.Item pedido,
                                          @AuthenticationPrincipal UsuarioAutenticado autenticado) {
        return service.adicionarItem(id, pedido.produtoId(), pedido.quantidade(), autenticado);
    }

    @PatchMapping("/{id}/itens/{itemId}")
    public VendaResponseDTO alterarQuantidade(@PathVariable Long id, @PathVariable Long itemId,
            @Valid @RequestBody OperacaoVendaDTO.Quantidade pedido,
            @AuthenticationPrincipal UsuarioAutenticado autenticado) {
        return service.alterarQuantidade(id, itemId, pedido.quantidade(), autenticado);
    }

    @DeleteMapping("/{id}/itens/{itemId}")
    public VendaResponseDTO removerItem(@PathVariable Long id, @PathVariable Long itemId,
                                        @AuthenticationPrincipal UsuarioAutenticado autenticado) {
        return service.removerItem(id, itemId, autenticado);
    }

    @PatchMapping("/{id}/desconto")
    public VendaResponseDTO aplicarDesconto(@PathVariable Long id, @Valid @RequestBody OperacaoVendaDTO.Desconto pedido,
                                           @AuthenticationPrincipal UsuarioAutenticado autenticado) {
        return service.aplicarDesconto(id, pedido.desconto(), autenticado);
    }

    @PutMapping("/{id}/cliente")
    public VendaResponseDTO vincularCliente(@PathVariable Long id, @Valid @RequestBody OperacaoVendaDTO.Cliente pedido,
                                            @AuthenticationPrincipal UsuarioAutenticado autenticado) {
        return service.vincularCliente(id, pedido.clienteId(), autenticado);
    }

    @DeleteMapping("/{id}/cliente")
    public VendaResponseDTO removerCliente(@PathVariable Long id, @AuthenticationPrincipal UsuarioAutenticado autenticado) {
        return service.removerCliente(id, autenticado);
    }

    @PostMapping("/{id}/faturar")
    public VendaResponseDTO faturar(@PathVariable Long id, @Valid @RequestBody FaturamentoVendaDTO pedido,
                                    @AuthenticationPrincipal UsuarioAutenticado autenticado) {
        return service.faturar(id, pedido, autenticado);
    }

    @GetMapping("/{id}")
    public VendaResponseDTO buscar(@PathVariable Long id, @AuthenticationPrincipal UsuarioAutenticado autenticado) {
        return service.buscar(id, autenticado.empresaId());
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<String> tratarRegra(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(e.getReason());
    }
}
