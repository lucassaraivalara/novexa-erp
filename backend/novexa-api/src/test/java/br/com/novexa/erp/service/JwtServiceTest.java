package br.com.novexa.erp.service;

import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.entity.PerfilUsuario;
import br.com.novexa.erp.entity.UsuarioEntity;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String SECRET = "01234567890123456789012345678901";
    private static final Long USUARIO_ID = 10L;
    private static final Long EMPRESA_ID = 20L;
    private static final String CPF = "02360684663";
    private static final PerfilUsuario PERFIL = PerfilUsuario.ADMIN;

    private JwtService jwtService;

    @BeforeEach
    void configurar() {
        jwtService = new JwtService(SECRET, 60_000);
    }

    @Test
    void deveGerarTokenAssinadoComClaimsObrigatorios() {
        String token = jwtService.gerarToken(USUARIO_ID, CPF, EMPRESA_ID, PERFIL);

        assertThat(token).isNotBlank();
        assertThat(jwtService.validarAssinatura(token)).isTrue();
        assertThat(jwtService.validarToken(token)).isTrue();
    }

    @Test
    void deveextrairUsuarioId() {
        String token = token();

        assertThat(jwtService.extrairUsuarioId(token)).isEqualTo(USUARIO_ID);
    }

    @Test
    void deveextrairCpf() {
        String token = token();

        assertThat(jwtService.extrairCpf(token)).isEqualTo(CPF);
    }

    @Test
    void deveextrairEmpresaId() {
        String token = token();

        assertThat(jwtService.extrairEmpresaId(token)).isEqualTo(EMPRESA_ID);
    }

    @Test
    void deveextrairPerfil() {
        String token = token();

        assertThat(jwtService.extrairPerfil(token)).isEqualTo(PERFIL);
    }

    @Test
    void deveValidarTokenValido() {
        String token = token();

        assertThat(jwtService.validarToken(token)).isTrue();
    }

    @Test
    void deveIdentificarTokenExpirado() throws InterruptedException {
        JwtService jwtServiceCurto = new JwtService(SECRET, 1);
        String token = jwtServiceCurto.gerarToken(USUARIO_ID, CPF, EMPRESA_ID, PERFIL);

        Thread.sleep(20);

        assertThat(jwtServiceCurto.verificarExpiracao(token)).isTrue();
        assertThat(jwtServiceCurto.validarAssinatura(token)).isTrue();
        assertThat(jwtServiceCurto.validarToken(token)).isFalse();
    }

    @Test
    void deveRecusarTokenInvalido() {
        String tokenInvalido = "token-invalido";

        assertThat(jwtService.validarAssinatura(tokenInvalido)).isFalse();
        assertThat(jwtService.validarToken(tokenInvalido)).isFalse();
        assertThatThrownBy(() -> jwtService.extrairClaims(tokenInvalido))
                .isInstanceOf(JwtException.class);
    }

    @Test
    void deveRecusarTokenAssinadoComOutroSegredo() {
        JwtService outroServico = new JwtService("abcdefghijklmnopqrstuvwxyz123456", 60_000);
        String token = jwtService.gerarToken(USUARIO_ID, CPF, EMPRESA_ID, PERFIL);

        assertThat(outroServico.validarAssinatura(token)).isFalse();
        assertThat(outroServico.validarToken(token)).isFalse();
    }

    @Test
    void deveGerarTokenApartirDeUsuario() {
        UsuarioEntity usuario = new UsuarioEntity();
        usuario.setId(USUARIO_ID);
        usuario.setCpf(CPF);
        usuario.setPerfil(PERFIL);
        EmpresaEntity empresa = new EmpresaEntity();
        empresa.setId(EMPRESA_ID);
        usuario.setEmpresa(empresa);

        String token = jwtService.gerarToken(usuario);

        assertThat(jwtService.extrairUsuarioId(token)).isEqualTo(USUARIO_ID);
        assertThat(jwtService.extrairEmpresaId(token)).isEqualTo(EMPRESA_ID);
    }

    private String token() {
        return jwtService.gerarToken(USUARIO_ID, CPF, EMPRESA_ID, PERFIL);
    }
}
