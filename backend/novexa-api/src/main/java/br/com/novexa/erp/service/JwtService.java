package br.com.novexa.erp.service;

import br.com.novexa.erp.entity.PerfilUsuario;
import br.com.novexa.erp.entity.UsuarioEntity;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Service
public class JwtService {

    public static final String CLAIM_CPF = "cpf";
    public static final String CLAIM_USUARIO_ID = "usuarioId";
    public static final String CLAIM_EMPRESA_ID = "empresaId";
    public static final String CLAIM_PERFIL = "perfil";

    private final SecretKey chaveAssinatura;
    private final long expirationMs;

    public JwtService(
            @Value("${novexa.jwt.secret}") String secret,
            @Value("${novexa.jwt.expiration-ms}") long expirationMs) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalArgumentException("O segredo JWT é obrigatório.");
        }

        byte[] secretBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (secretBytes.length < 32) {
            throw new IllegalArgumentException("O segredo JWT deve possuir pelo menos 32 caracteres.");
        }

        if (expirationMs <= 0) {
            throw new IllegalArgumentException("O tempo de expiração do JWT deve ser positivo.");
        }

        this.chaveAssinatura = Keys.hmacShaKeyFor(secretBytes);
        this.expirationMs = expirationMs;
    }

    public String gerarToken(UsuarioEntity usuario) {
        if (usuario == null || usuario.getId() == null || usuario.getEmpresa() == null
                || usuario.getEmpresa().getId() == null || usuario.getPerfil() == null) {
            throw new IllegalArgumentException("Usuário, empresa e perfil são obrigatórios para gerar o JWT.");
        }

        return gerarToken(
                usuario.getId(),
                usuario.getCpf(),
                usuario.getEmpresa().getId(),
                usuario.getPerfil()
        );
    }

    public String gerarToken(
            Long usuarioId,
            String cpf,
            Long empresaId,
            PerfilUsuario perfil) {

        if (usuarioId == null || cpf == null || cpf.isBlank() || empresaId == null || perfil == null) {
            throw new IllegalArgumentException("Usuário, CPF, empresa e perfil são obrigatórios para gerar o JWT.");
        }

        Date agora = new Date();

        return Jwts.builder()
                .claim(CLAIM_USUARIO_ID, usuarioId)
                .claim(CLAIM_CPF, cpf)
                .claim(CLAIM_EMPRESA_ID, empresaId)
                .claim(CLAIM_PERFIL, perfil.name())
                .issuedAt(agora)
                .expiration(new Date(agora.getTime() + expirationMs))
                .signWith(chaveAssinatura)
                .compact();
    }

    public Claims extrairClaims(String token) {
        return Jwts.parser()
                .verifyWith(chaveAssinatura)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String extrairCpf(String token) {
        return extrairClaims(token).get(CLAIM_CPF, String.class);
    }

    public Long extrairUsuarioId(String token) {
        return extrairClaims(token).get(CLAIM_USUARIO_ID, Long.class);
    }

    public Long extrairEmpresaId(String token) {
        return extrairClaims(token).get(CLAIM_EMPRESA_ID, Long.class);
    }

    public PerfilUsuario extrairPerfil(String token) {
        String perfil = extrairClaims(token).get(CLAIM_PERFIL, String.class);
        return PerfilUsuario.valueOf(perfil);
    }

    public boolean verificarExpiracao(String token) {
        try {
            Date expiracao = extrairClaims(token).getExpiration();
            return expiracao == null || expiracao.before(new Date());
        } catch (ExpiredJwtException e) {
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public boolean validarAssinatura(String token) {
        if (token == null || token.isBlank()) {
            return false;
        }

        try {
            extrairClaims(token);
            return true;
        } catch (ExpiredJwtException e) {
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public boolean validarToken(String token) {
        if (token == null || token.isBlank()) {
            return false;
        }

        try {
            Claims claims = extrairClaims(token);
            return claims.getExpiration() != null
                    && !claims.getExpiration().before(new Date())
                    && claims.get(CLAIM_USUARIO_ID) != null
                    && claims.get(CLAIM_CPF) != null
                    && claims.get(CLAIM_EMPRESA_ID) != null
                    && claims.get(CLAIM_PERFIL) != null;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }
}
