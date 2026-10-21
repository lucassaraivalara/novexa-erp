package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.RecebivelService;
import br.com.novexa.erp.service.LiquidacaoRecebivelService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;

@RestController
@RequestMapping("/financeiro/recebiveis")
public class RecebivelController {
    @org.springframework.beans.factory.annotation.Autowired private br.com.novexa.erp.service.AgendaRecebimentosService agenda;
    @GetMapping("/agenda")
    public PaginaResponseDTO<AgendaRecebimentosDTO> agenda(@RequestParam(defaultValue="0") int page,
            @RequestParam(defaultValue="25") int size,@AuthenticationPrincipal UsuarioAutenticado usuario) {
        return agenda.listar(usuario.empresaId(),page,size);
    }
    @GetMapping("/agenda/itens")
    public PaginaResponseDTO<AgendaItemDTO> itens(@RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate data,
            @RequestParam(required=false) Long configuracaoId,@RequestParam String tipo,@RequestParam(required=false) Long contaDestinoId,
            @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="200") int size,@AuthenticationPrincipal UsuarioAutenticado usuario) {
        return agenda.itens(usuario.empresaId(),data,configuracaoId,tipo,contaDestinoId,page,size);
    }
    private final RecebivelService service;
    private final LiquidacaoRecebivelService liquidacao;
    public RecebivelController(RecebivelService service, LiquidacaoRecebivelService liquidacao) {
        this.service = service; this.liquidacao = liquidacao;
    }

    public record Lote(@jakarta.validation.constraints.NotEmpty @jakarta.validation.constraints.Size(max=200)
            java.util.List<@jakarta.validation.constraints.NotNull @jakarta.validation.constraints.Positive Long> recebivelIds) { }
    @PostMapping("/liquidar-lote")
    public java.util.List<RecebivelResponseDTO> liquidarLote(@jakarta.validation.Valid @RequestBody Lote pedido,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return liquidacao.liquidarLote(pedido.recebivelIds(),usuario.empresaId(),usuario.usuarioId());
    }
    @PostMapping("/{id}/liquidar")
    public RecebivelResponseDTO liquidar(@PathVariable Long id, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return liquidacao.liquidar(id, usuario.empresaId(), usuario.usuarioId());
    }

    @GetMapping
    public PaginaResponseDTO<RecebivelResponseDTO> listar(
            @RequestParam(required = false) StatusRecebivel status,
            @RequestParam(required = false) TipoFormaPagamento tipo,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicial,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFinal,
            @RequestParam(required = false) Long vendaId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "dataVenda,desc") String sort,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return service.listar(usuario.empresaId(), status, tipo, dataInicial, dataFinal, vendaId, page, size, sort);
    }
}
