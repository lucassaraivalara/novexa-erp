package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.LoginRequestDTO;
import br.com.novexa.erp.dto.LoginResponseDTO;
import br.com.novexa.erp.entity.UsuarioEntity;
import br.com.novexa.erp.mapper.UsuarioMapper;
import br.com.novexa.erp.service.UsuarioService;
import br.com.novexa.erp.service.JwtService;
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
    private final JwtService jwtService;

    public AuthController(
            UsuarioService usuarioService,
            UsuarioMapper usuarioMapper,
            JwtService jwtService) {

        this.usuarioService = usuarioService;
        this.usuarioMapper = usuarioMapper;
        this.jwtService = jwtService;
    }

    // POST /auth/login
    @PostMapping("/login")
    public LoginResponseDTO login(@Valid @RequestBody LoginRequestDTO request) {
        UsuarioEntity usuario = usuarioService.autenticar(
                request.getCpf(),
                request.getSenha()
        );

        LoginResponseDTO response = usuarioMapper.toLoginResponse(usuario);
        response.setToken(jwtService.gerarToken(
                usuario.getId(),
                usuario.getCpf().replaceAll("\\D", ""),
                usuario.getEmpresa().getId(),
                usuario.getPerfil()
        ));
        response.setTipo("Bearer");
        return response;
    }
}
