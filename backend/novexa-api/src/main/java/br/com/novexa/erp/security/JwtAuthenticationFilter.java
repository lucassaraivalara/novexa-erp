package br.com.novexa.erp.security;

import br.com.novexa.erp.entity.PerfilUsuario;
import br.com.novexa.erp.service.JwtService;
import br.com.novexa.erp.repository.UsuarioRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Date;
import java.util.List;

public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final AuthenticationEntryPoint authenticationEntryPoint;
    private final UsuarioRepository usuarios;

    public JwtAuthenticationFilter(JwtService jwtService, AuthenticationEntryPoint authenticationEntryPoint, UsuarioRepository usuarios) {
        this.jwtService = jwtService;
        this.authenticationEntryPoint = authenticationEntryPoint;
        this.usuarios = usuarios;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization != null) {
            try {
                if (!authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
                    throw new BadCredentialsException("Token inválido.");
                }

                // O parser existente verifica assinatura e expiração antes de disponibilizar as claims.
                Claims claims = jwtService.extrairClaims(authorization.substring(7).trim());
                UsuarioAutenticado principal = criarPrincipal(claims);
                validarVinculoAtual(principal);
                var authentication = UsernamePasswordAuthenticationToken.authenticated(
                        principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + principal.perfil().name())));
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                var context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(authentication);
                SecurityContextHolder.setContext(context);
            } catch (JwtException | IllegalArgumentException | BadCredentialsException exception) {
                SecurityContextHolder.clearContext();
                authenticationEntryPoint.commence(request, response, new BadCredentialsException("Token inválido."));
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private UsuarioAutenticado criarPrincipal(Claims claims) {
        Long usuarioId = claims.get(JwtService.CLAIM_USUARIO_ID, Long.class);
        String cpf = claims.get(JwtService.CLAIM_CPF, String.class);
        Long empresaId = claims.get(JwtService.CLAIM_EMPRESA_ID, Long.class);
        String perfil = claims.get(JwtService.CLAIM_PERFIL, String.class);
        Date expiracao = claims.getExpiration();

        if (usuarioId == null || usuarioId <= 0 || cpf == null || !cpf.matches("[0-9]{11}")
                || empresaId == null || empresaId <= 0 || perfil == null
                || expiracao == null || !expiracao.after(new Date())) {
            throw new BadCredentialsException("Claims obrigatórias inválidas.");
        }

        return new UsuarioAutenticado(usuarioId, cpf, empresaId, PerfilUsuario.valueOf(perfil));
    }
    private void validarVinculoAtual(UsuarioAutenticado principal) {
        var usuario = usuarios.findByIdAndEmpresaId(principal.usuarioId(), principal.empresaId())
                .orElseThrow(() -> new BadCredentialsException("Vinculo de usuario invalido."));
        if (Boolean.FALSE.equals(usuario.getAtivo()) || usuario.getEmpresa() == null
                || Boolean.FALSE.equals(usuario.getEmpresa().getAtivo())
                || usuario.getPerfil() != principal.perfil())
            throw new BadCredentialsException("Usuario, empresa ou perfil indisponivel.");
    }
}
