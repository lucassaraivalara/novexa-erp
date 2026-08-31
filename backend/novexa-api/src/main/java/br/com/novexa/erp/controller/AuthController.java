package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.LoginRequestDTO;
import br.com.novexa.erp.dto.LoginResponseDTO;
import br.com.novexa.erp.entity.UsuarioEntity;
import br.com.novexa.erp.mapper.UsuarioMapper;
import br.com.novexa.erp.service.UsuarioService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final UsuarioService usuarioService;
    private final UsuarioMapper usuarioMapper;

    public AuthController(
            UsuarioService usuarioService,
            UsuarioMapper usuarioMapper) {

        this.usuarioService = usuarioService;
        this.usuarioMapper = usuarioMapper;
    }

    // POST /auth/login
    @PostMapping("/login")
    public LoginResponseDTO login(@Valid @RequestBody LoginRequestDTO request) {
        UsuarioEntity usuario = usuarioService.autenticar(
                request.getCpf(),
                request.getSenha()
        );

        return usuarioMapper.toLoginResponse(usuario);
    }
}
