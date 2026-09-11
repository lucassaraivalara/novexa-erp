package br.com.novexa.erp.security;

import br.com.novexa.erp.config.CorsConfig;
import br.com.novexa.erp.config.PasswordConfig;
import br.com.novexa.erp.config.SecurityConfig;
import br.com.novexa.erp.controller.AuthController;
import br.com.novexa.erp.controller.EmpresaController;
import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.entity.PerfilUsuario;
import br.com.novexa.erp.entity.UsuarioEntity;
import br.com.novexa.erp.mapper.EmpresaMapper;
import br.com.novexa.erp.mapper.UsuarioMapper;
import br.com.novexa.erp.repository.UsuarioRepository;
import br.com.novexa.erp.service.EmpresaService;
import br.com.novexa.erp.service.JwtService;
import br.com.novexa.erp.service.UsuarioService;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = {AuthController.class, EmpresaController.class}, properties = {
        "novexa.jwt.secret=01234567890123456789012345678901",
        "novexa.jwt.expiration-ms=60000"
})
@Import({SecurityConfig.class, CorsConfig.class, PasswordConfig.class, JwtService.class,
        UsuarioService.class, UsuarioMapper.class, EmpresaMapper.class, JwtAuthenticationTest.ContextoController.class})
class JwtAuthenticationTest {

    private static final String SECRET = "01234567890123456789012345678901";
    private static final String CPF = "02360684663";

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private PasswordEncoder passwordEncoder;
    @MockitoSpyBean private JwtService jwtService;
    @MockitoBean private UsuarioRepository usuarioRepository;
    @MockitoBean private EmpresaService empresaService;

    @ParameterizedTest
    @EnumSource(PerfilUsuario.class)
    void loginPublicoGeraJwtValidoEPreservaResposta(PerfilUsuario perfil) throws Exception {
        UsuarioEntity usuario = usuario(perfil);
        // O banco legado também pode conter CPF com máscara.
        usuario.setCpf("023.606.846-63");
        when(usuarioRepository.findByCpfNormalizado(CPF)).thenReturn(Optional.of(usuario));

        var resultado = login("senha123")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.nomeUsuario").value("Usuário de teste"))
                .andExpect(jsonPath("$.cpf").value("023.606.846-63"))
                .andExpect(jsonPath("$.email").value("teste@novexa.com"))
                .andExpect(jsonPath("$.perfil").value(perfil.name()))
                .andExpect(jsonPath("$.empresa.id").value(10))
                .andExpect(jsonPath("$.empresa.nomeFantasia").value("Empresa de teste"))
                .andExpect(jsonPath("$.tipo").value("Bearer"))
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.senha").doesNotExist())
                .andReturn();

        String token = json.readTree(resultado.getResponse().getContentAsString()).get("token").asText();
        assertThat(jwtService.validarToken(token)).isTrue();
        assertThat(jwtService.extrairClaims(token)).containsOnlyKeys(
                "usuarioId", "cpf", "empresaId", "perfil", "iat", "exp");
        assertThat(jwtService.extrairCpf(token)).isEqualTo(CPF);
        assertThat(resultado.getRequest().getSession(false)).isNull();
        assertThat(resultado.getResponse().getContentAsString()).doesNotContain(usuario.getSenha());

        mvc.perform(get("/teste/contexto").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.principal.usuarioId").value(1))
                .andExpect(jsonPath("$.principal.cpf").value(CPF))
                .andExpect(jsonPath("$.principal.empresaId").value(10))
                .andExpect(jsonPath("$.principal.perfil").value(perfil.name()))
                .andExpect(jsonPath("$.authorities[0]").value("ROLE_" + perfil.name()))
                .andExpect(jsonPath("$.nome").value(CPF));
    }

    @ParameterizedTest
    @ValueSource(strings = {"senha", "usuarioInativo", "empresaInativa", "semEmpresa", "cpfInexistente"})
    void loginRecusadoNaoGeraToken(String caso) throws Exception {
        UsuarioEntity usuario = usuario(PerfilUsuario.USUARIO);
        if (caso.equals("usuarioInativo")) usuario.setAtivo(false);
        if (caso.equals("empresaInativa")) usuario.getEmpresa().setAtivo(false);
        if (caso.equals("semEmpresa")) usuario.setEmpresa(null);
        when(usuarioRepository.findByCpfNormalizado(CPF))
                .thenReturn(caso.equals("cpfInexistente") ? Optional.empty() : Optional.of(usuario));

        login(caso.equals("senha") ? "incorreta" : "senha123")
                .andExpect(status().isUnauthorized())
                .andExpect(content().string(not(containsString("token"))))
                .andExpect(content().string(not(containsString(usuario.getSenha()))));

        verify(jwtService, never()).gerarToken(anyLong(), anyString(), anyLong(), any());
        verify(jwtService, never()).gerarToken(any(UsuarioEntity.class));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/empresas", "/usuarios", "/produtos?empresaId=10", "/clientes?empresaId=10",
            "/fornecedores?empresaId=10", "/auth/login", "/actuator/health"})
    void endpointsSemTokenRetornam401(String url) throws Exception {
        mvc.perform(get(url)).andExpect(status().isUnauthorized())
                .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, "Bearer"));
        verifyNoInteractions(empresaService);
    }

    @ParameterizedTest
    @CsvSource({"POST,/empresas", "PUT,/empresas/10", "DELETE,/empresas/10", "PUT,/auth/login",
            "POST,/auth/login/extra", "POST,/logout"})
    void operacoesSemTokenRetornam401(String metodo, String url) throws Exception {
        mvc.perform(request(HttpMethod.valueOf(metodo), url)).andExpect(status().isUnauthorized());
        verifyNoInteractions(empresaService);
    }

    @Test
    void tokenValidoChegaAoEndpointESegurancaNaoCriaSessao() throws Exception {
        when(empresaService.listar(10L)).thenReturn(List.of(usuario(PerfilUsuario.ADMIN).getEmpresa()));
        var resultado = mvc.perform(get("/empresas").header(HttpHeaders.AUTHORIZATION, "Bearer " + token()))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(10)).andReturn();
        verify(empresaService).listar(10L);
        assertThat(resultado.getRequest().getSession(false)).isNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        mvc.perform(get("/empresas")).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @ValueSource(strings = {"Bearer token-invalido", "Bearer ", "Basic abc", "Bearer", ""})
    void headerOuTokenInvalidoRetorna401(String authorization) throws Exception {
        rejeitar(authorization);
    }

    @Test
    void assinaturaInvalidaRetorna401() throws Exception {
        String token = new JwtService("abcdefghijklmnopqrstuvwxyz123456", 60000)
                .gerarToken(1L, CPF, 10L, PerfilUsuario.ADMIN);
        rejeitar("Bearer " + token);
    }

    @Test
    void tokenExpiradoRetorna401() throws Exception {
        rejeitar("Bearer " + assinar(claims(), new Date(System.currentTimeMillis() - 60000)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"usuarioId", "cpf", "empresaId", "perfil", "exp"})
    void claimObrigatoriaAusenteRetorna401(String claim) throws Exception {
        Map<String, Object> claims = claims();
        claims.remove(claim);
        rejeitar("Bearer " + assinar(claims, claim.equals("exp") ? null : new Date(System.currentTimeMillis() + 60000)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"usuarioId", "empresaId", "cpf", "perfil", "idNegativo", "idFracionario", "cpfBranco"})
    void claimInvalidaRetorna401(String caso) throws Exception {
        Map<String, Object> claims = claims();
        switch (caso) {
            case "idNegativo" -> claims.put("usuarioId", -1);
            case "idFracionario" -> claims.put("empresaId", 1.5);
            case "cpfBranco" -> claims.put("cpf", " ");
            case "cpf" -> claims.put("cpf", 123);
            default -> claims.put(caso, "INVALIDO");
        }
        rejeitar("Bearer " + assinar(claims, new Date(System.currentTimeMillis() + 60000)));
    }

    @Test
    void preflightCorsPermiteAuthorizationSemToken() throws Exception {
        mvc.perform(options("/empresas")
                        .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Authorization"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:5173"))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_HEADERS, "Authorization"));
        verifyNoInteractions(empresaService);
    }

    @Test
    void acessoNegadoAutenticadoRetorna403SemDetalhesInternos() throws Exception {
        mvc.perform(get("/teste/negado").header(HttpHeaders.AUTHORIZATION, "Bearer " + token()))
                .andExpect(status().isForbidden()).andExpect(content().string("Acesso negado."));
    }

    private ResultActions login(String senha) throws Exception {
        return mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(Map.of("cpf", "023.606.846-63", "senha", senha))));
    }

    private void rejeitar(String authorization) throws Exception {
        mvc.perform(get("/empresas").header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isUnauthorized())
                .andExpect(content().string("Autenticação necessária ou token inválido."));
        verifyNoInteractions(empresaService);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    private String token() {
        return jwtService.gerarToken(1L, CPF, 10L, PerfilUsuario.ADMIN);
    }

    private Map<String, Object> claims() {
        return new HashMap<>(Map.of("usuarioId", 1L, "cpf", CPF, "empresaId", 10L, "perfil", "ADMIN"));
    }

    private String assinar(Map<String, Object> claims, Date expiracao) {
        return Jwts.builder().claims(claims).expiration(expiracao)
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
    }

    private UsuarioEntity usuario(PerfilUsuario perfil) {
        EmpresaEntity empresa = new EmpresaEntity();
        empresa.setId(10L);
        empresa.setNomeFantasia("Empresa de teste");
        empresa.setAtivo(true);
        UsuarioEntity usuario = new UsuarioEntity();
        usuario.setId(1L);
        usuario.setNomeUsuario("Usuário de teste");
        usuario.setCpf(CPF);
        usuario.setEmail("teste@novexa.com");
        usuario.setSenha(passwordEncoder.encode("senha123"));
        usuario.setPerfil(perfil);
        usuario.setEmpresa(empresa);
        return usuario;
    }

    // Endpoints exclusivos do teste; nenhuma rota ou regra de perfil é adicionada à aplicação.
    @RestController
    static class ContextoController {
        @GetMapping("/teste/contexto")
        Map<String, Object> contexto(@AuthenticationPrincipal UsuarioAutenticado principal, Authentication authentication) {
            assertThat(authentication.isAuthenticated()).isTrue();
            assertThat(authentication.getCredentials()).isNull();
            return Map.of("principal", principal, "nome", authentication.getName(), "authorities",
                    authentication.getAuthorities().stream().map(a -> a.getAuthority()).toList());
        }

        @GetMapping("/teste/negado")
        void negado() {
            throw new AccessDeniedException("Detalhe interno que não deve aparecer na resposta.");
        }
    }
}
