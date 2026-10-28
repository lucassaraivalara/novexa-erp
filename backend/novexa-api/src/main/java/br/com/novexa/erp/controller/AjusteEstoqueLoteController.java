package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.AjusteEstoqueLoteDTO.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.AjusteEstoqueLoteService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/estoque/ajustes-lote")
public class AjusteEstoqueLoteController {
    private final AjusteEstoqueLoteService service;
    public AjusteEstoqueLoteController(AjusteEstoqueLoteService service) { this.service=service; }
    @PostMapping("/previa") public Resultado previa(@RequestBody Pedido p,@AuthenticationPrincipal UsuarioAutenticado u) {return service.previa(p,u);}
    @PostMapping("/confirmar") public Resultado confirmar(@RequestBody Pedido p,@AuthenticationPrincipal UsuarioAutenticado u) {return service.confirmar(p,u);}
}
