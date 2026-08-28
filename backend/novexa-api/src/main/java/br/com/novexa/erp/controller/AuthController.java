package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.LoginRequestDTO;
import br.com.novexa.erp.dto.LoginResponseDTO;
import br.com.novexa.erp.entity.UsuarioEntity;
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

    public AuthController(UsuarioService usuarioService) {
        this.usuarioService = usuarioService;
    }

    // POST /auth/login
    @PostMapping("/login")
    public LoginResponseDTO login(@Valid @RequestBody LoginRequestDTO request) {
        UsuarioEntity usuario = usuarioService.autenticar(
                request.getCpf(),
                request.getSenha()
        );

        LoginResponseDTO response = new LoginResponseDTO();
        response.setId(usuario.getId());
        response.setNomeUsuario(usuario.getNomeUsuario());
        response.setCpf(usuario.getCpf());
        response.setEmail(usuario.getEmail());
        return response;
    }
}
