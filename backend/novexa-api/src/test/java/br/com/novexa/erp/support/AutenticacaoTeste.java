package br.com.novexa.erp.support;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.UsuarioRepository;
import br.com.novexa.erp.service.JwtService;

public final class AutenticacaoTeste {
    public static String token(br.com.novexa.erp.repository.EmpresaRepository empresas, UsuarioRepository usuarios,
                               JwtService jwt, PerfilUsuario perfil, String cpf) {
        var empresa = new EmpresaEntity();
        empresa.setRazaoSocial("Empresa de autenticacao");
        empresa.setAtivo(true);
        return token(usuarios, jwt, empresas.save(empresa), perfil, cpf);
    }
    private AutenticacaoTeste() { }
    public static String token(UsuarioRepository usuarios, JwtService jwt, EmpresaEntity empresa,
            PerfilUsuario perfil, String cpf) {
        var usuario = new UsuarioEntity();
        usuario.setEmpresa(empresa); usuario.setPerfil(perfil); usuario.setCpf(cpf);
        usuario.setNomeUsuario("Usuario de teste");
        usuario.setSenha(new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder().encode("senhaTeste123"));
        return "Bearer " + jwt.gerarToken(usuarios.saveAndFlush(usuario));
    }
}
