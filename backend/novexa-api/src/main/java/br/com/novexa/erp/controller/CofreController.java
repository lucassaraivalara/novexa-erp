package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.EntregaCofreDTO;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.CofreService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import java.util.Map;

@RestController @RequestMapping("/financeiro/cofre")
public class CofreController {
    private final CofreService service;
    private final br.com.novexa.erp.service.ContaFinanceiraService financeiro;
    private final br.com.novexa.erp.repository.ContaFinanceiraRepository contas;
    public CofreController(CofreService service,br.com.novexa.erp.service.ContaFinanceiraService financeiro,
            br.com.novexa.erp.repository.ContaFinanceiraRepository contas) { this.service=service;this.financeiro=financeiro;this.contas=contas; }
    @GetMapping("/contas/{id}/movimentos") public br.com.novexa.erp.dto.PaginaResponseDTO<br.com.novexa.erp.dto.MovimentacaoFinanceiraResponseDTO> movimentos(
            @PathVariable Long id,@RequestParam(defaultValue="0") int page,@AuthenticationPrincipal UsuarioAutenticado a) {
        contas.findById(id).filter(c->c.getEmpresa().getId().equals(a.empresaId())&&c.getTipo()==br.com.novexa.erp.entity.TipoContaFinanceira.COFRE)
                .orElseThrow(()->new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND,"Cofre não encontrado."));
        return financeiro.listarMovimentosPagina(a.empresaId(),id,null,null,null,null,null,page,20,"dataMovimento,desc");
    }
    @GetMapping("/resumo") public Map<String,Object> resumo(@AuthenticationPrincipal UsuarioAutenticado a) { return service.resumo(a); }
    @GetMapping("/pendencias") public Map<String,Object> pendencias(@AuthenticationPrincipal UsuarioAutenticado a,@RequestParam(defaultValue="0") int page) { return service.pendencias(a,page); }
    @GetMapping("/recolhimentos") public Map<String,Object> historico(@AuthenticationPrincipal UsuarioAutenticado a,@RequestParam(defaultValue="0") int page) { return service.historico(a,page); }
    @PostMapping("/sessoes/{id}/recolhimento") public CofreService.Registro destinar(@PathVariable Long id,@Valid @RequestBody EntregaCofreDTO p,@AuthenticationPrincipal UsuarioAutenticado a) { return service.destinar(id,p,a); }
    public record Confirmacao(boolean confirmarEntrega) { }
    @PostMapping("/recolhimentos/{id}/confirmar") public CofreService.Registro confirmar(@PathVariable Long id,@RequestBody Confirmacao p,@AuthenticationPrincipal UsuarioAutenticado a) { return service.confirmar(id,p.confirmarEntrega(),a); }
    @PostMapping("/devolucoes") public CofreService.Registro devolver(@Valid @RequestBody CofreService.Devolucao p,@AuthenticationPrincipal UsuarioAutenticado a) { return service.devolver(p,a); }
}
