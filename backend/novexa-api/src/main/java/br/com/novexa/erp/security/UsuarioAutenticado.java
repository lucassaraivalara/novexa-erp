package br.com.novexa.erp.security;

import br.com.novexa.erp.entity.PerfilUsuario;

import java.security.Principal;

// Disponível nos controllers por @AuthenticationPrincipal, sem carregar a entidade ou a senha.
public record UsuarioAutenticado(Long usuarioId, String cpf, Long empresaId, PerfilUsuario perfil)
        implements Principal {

    @Override
    public String getName() {
        return cpf;
    }
}
