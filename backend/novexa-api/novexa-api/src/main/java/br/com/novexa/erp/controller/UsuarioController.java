package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.UsuarioEntity;
import br.com.novexa.erp.service.UsuarioService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/usuarios")
public class UsuarioController {

    private final UsuarioService usuarioService;

    // Construtor:
    // recebe o UsuarioService para que o Spring possa
    // disponibilizá-lo dentro deste Controller.
    public UsuarioController(UsuarioService usuarioService) {
        this.usuarioService = usuarioService;
    }

    // POST /usuarios
    // Recebe os dados de um usuário em formato JSON
    // e envia esse usuário para o Service salvar.
    @PostMapping
    public UsuarioEntity salvar(@RequestBody UsuarioEntity usuario) {
        return usuarioService.salvar(usuario);
    }
}