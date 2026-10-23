package br.com.novexa.erp.security;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.service.JwtService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.persistence.EntityManagerFactory;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.*;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.DefaultSecurityFilterChain;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.bind.annotation.*;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

/** Segurança HTTP real e medição test-only, sem cache ou simulação do repository. */
@EnabledIfSystemProperty(named = "novexa.test.auth.jdbc-url",
        matches = "jdbc:postgresql://(?:127\\.0\\.0\\.1|localhost):[0-9]+/novexa_auth_performance_test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.jpa.open-in-view=false", "spring.jpa.show-sql=false",
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "logging.level.org.hibernate.engine.internal.StatisticalLoggingSessionEventListener=OFF",
        "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=600000",
        "supabase.url=http://127.0.0.1:9", "supabase.secret-key=synthetic-test-only", "supabase.bucket=local",
        "novexa.geocoding.url="
})
@Import({AutenticacaoPerformancePostgresTest.MedicaoConfig.class, AutenticacaoPerformancePostgresTest.ContextoController.class})
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AutenticacaoPerformancePostgresTest {
    static final String URL = System.getProperty("novexa.test.auth.jdbc-url");
    static final String SCHEMA = "auth_performance_" + UUID.randomUUID().toString().replace("-", "");
    static final String SECRET = "01234567890123456789012345678901";
    static final String SENHA = "senhaTeste123";
    static final String LOGO = "data:image/svg+xml;base64," + Base64.getEncoder().encodeToString(
            ("<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><rect width='32' height='32' fill='blue'/><!--"
                    + "x".repeat(728580) + "--></svg>").getBytes(StandardCharsets.UTF_8));
    @DynamicPropertySource static void postgres(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", () -> URL + "?currentSchema=" + SCHEMA + "&sslmode=disable&gssEncMode=disable");
        p.add("spring.datasource.username", () -> "postgres"); p.add("spring.datasource.password", () -> "");
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.jpa.hibernate.ddl-auto", () -> "validate"); p.add("spring.flyway.enabled", () -> "true");
        p.add("spring.flyway.schemas", () -> SCHEMA); p.add("spring.flyway.default-schema", () -> SCHEMA);
    }
    @Autowired TestRestTemplate http;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired JwtService jwt;
    @Autowired PasswordEncoder encoder;
    @Autowired EntityManagerFactory emf;
    @LocalServerPort int porta;
    final Map<PerfilUsuario, UsuarioEntity> pessoas = new EnumMap<>(PerfilUsuario.class);
    long empresa, outraEmpresa, conta, contaExterna, sessao;
    UsuarioEntity externo;

    @BeforeAll void preparar() throws Exception {
        var e = empresa("Empresa sintética", LOGO); empresa = e.getId();
        var outra = empresa("Outro tenant", null); outraEmpresa = outra.getId();
        String hash = encoder.encode(SENHA); int i = 0;
        for (var perfil : PerfilUsuario.values())
            pessoas.put(perfil, usuario(e, perfil, List.of("12345678909", "98765432100", "11144477735", "52998224725").get(i++), hash));
        externo = usuario(outra, PerfilUsuario.ADMIN, "39053344705", hash);
        conta = conta(empresa); contaExterna = conta(outraEmpresa);
        long admin = pessoas.get(PerfilUsuario.ADMIN).getId();
        jdbc.update("""
                insert into movimentacoes_financeiras(empresa_id,conta_financeira_id,tipo,origem,descricao,valor,
                    data_movimento,usuario_id,data_criacao,estornada)
                select ?,?,'ENTRADA','MANUAL','Movimento sintético '||i,10,date '2026-10-19',?,timestamp '2026-10-19 10:00',false
                from generate_series(1,60)i
                """, empresa, conta, admin);
        jdbc.update("update contas_financeiras set saldo_atual=600 where id=?", conta);
        long caixa = jdbc.queryForObject("insert into caixas(empresa_id,descricao,ativo) values (?,'Caixa sintético',true) returning id", Long.class, empresa);
        sessao = jdbc.queryForObject("""
                insert into sessoes_caixa(empresa_id,caixa_id,usuario_abertura_id,saldo_inicial,data_abertura,status)
                values (?,?,?,0,timestamp '2026-10-19 10:00','ABERTO') returning id
                """, Long.class, empresa, caixa, admin);
        String pasta = System.getProperty("novexa.test.auth.evidence-dir");
        if (pasta != null) {
            Files.createDirectories(Path.of(pasta));
            json.writeValue(Path.of(pasta, "fixture.json").toFile(), Map.of("schema", SCHEMA, "empresa", empresa,
                    "conta", conta, "sessao", sessao, "apiPort", porta, "logoBytes", LOGO.length()));
        }
    }
    @BeforeEach @AfterEach void restaurarEstadoDeSegurancaDaFixture() {
        jdbc.update("update empresas set ativo=true where id in (?,?)", empresa, outraEmpresa);
        jdbc.update("update empresas set logomarca=? where id=?", LOGO, empresa);
        for (var p : pessoas.entrySet())
            jdbc.update("update usuario set ativo=true,versao_token=0,perfil=?,empresa_id=? where id=?", p.getKey().name(), empresa, p.getValue().getId());
    }

    @ParameterizedTest @EnumSource(PerfilUsuario.class)
    void loginSenhaJwtContextoEPermissoesMantidos(PerfilUsuario perfil) throws Exception {
        var p = pessoas.get(perfil); var resposta = login(p.getCpf(), SENHA);
        assertThat(resposta.getStatusCode().value()).isEqualTo(200);
        var corpo = json.readTree(resposta.getBody()); String token = "Bearer " + corpo.path("token").asText();
        assertThat(corpo.path("empresa").path("id").asLong()).isEqualTo(empresa);
        assertThat(corpo.path("empresa").path("logomarca").asText()).isEqualTo(LOGO);
        assertThat(corpo.path("perfil").asText()).isEqualTo(perfil.name());
        assertThat(corpo.has("senha")).isFalse();
        var contexto = json.readTree(get(token, "/audit-auth/contexto").getBody());
        assertThat(contexto.path("empresaId").asLong()).isEqualTo(empresa);
        assertThat(contexto.path("usuarioId").asLong()).isEqualTo(p.getId());
        assertThat(contexto.path("perfil").asText()).isEqualTo(perfil.name());
        assertThat(contexto.path("autoridade").asText()).isEqualTo("ROLE_" + perfil.name());
        assertThat(get(token, "/usuarios/pagina").getStatusCode().value()).isEqualTo(perfil == PerfilUsuario.ADMIN ? 200 : 403);
        assertThat(get(token, "/financeiro/configuracoes-formas-pagamento").getStatusCode().value()).isEqualTo(200);
        var escrita = exchange(token, "/financeiro/configuracoes-formas-pagamento", HttpMethod.POST, Map.of());
        assertThat(escrita.getStatusCode().value()).isEqualTo(perfil == PerfilUsuario.ADMIN || perfil == PerfilUsuario.GERENTE ? 400 : 403);
    }

    @ParameterizedTest @ValueSource(strings = {"senha", "cpf", "vazio"})
    void loginInvalidoNaoRetornaToken(String caso) throws Exception {
        var resposta = login(caso.equals("cpf") ? "00000000000" : "12345678909", caso.equals("vazio") ? "" : "incorreta");
        assertThat(resposta.getStatusCode().value()).isEqualTo(caso.equals("vazio") ? 400 : 401);
        assertThat(resposta.getBody()).doesNotContain("Bearer", "logomarca", pessoas.get(PerfilUsuario.ADMIN).getSenha());
    }

    @ParameterizedTest @ValueSource(strings = {"usuarioInativo", "empresaInativa", "perfil", "versao", "empresaAlterada", "semEmpresa"})
    void alteracaoPersistidaRecusaTokenERenovacao(String caso) {
        // Mudança/remoção do vínculo usa usuário sem histórico financeiro: as FKs protegem o responsável do Caixa.
        var perfil = caso.equals("empresaAlterada") || caso.equals("semEmpresa") ? PerfilUsuario.USUARIO : PerfilUsuario.ADMIN;
        var pessoa = pessoas.get(perfil); String token = token(perfil); long usuario = pessoa.getId();
        switch (caso) {
            case "usuarioInativo" -> jdbc.update("update usuario set ativo=false where id=?", usuario);
            case "empresaInativa" -> jdbc.update("update empresas set ativo=false where id=?", empresa);
            case "perfil" -> jdbc.update("update usuario set perfil='OPERADOR' where id=?", usuario);
            case "versao" -> jdbc.update("update usuario set versao_token=1 where id=?", usuario);
            case "empresaAlterada" -> jdbc.update("update usuario set empresa_id=? where id=?", outraEmpresa, usuario);
            default -> jdbc.update("update usuario set empresa_id=null where id=?", usuario);
        }
        assertThat(get(token, "/audit-auth/contexto").getStatusCode().value()).isEqualTo(401);
        assertThat(exchange(token, "/auth/renovar", HttpMethod.POST, null).getStatusCode().value()).isEqualTo(401);
        if (caso.equals("usuarioInativo") || caso.equals("empresaInativa") || caso.equals("semEmpresa"))
            assertThat(login(pessoa.getCpf(), SENHA).getStatusCode().value()).isEqualTo(401);
    }

    @ParameterizedTest @ValueSource(strings = {"invalido", "assinatura", "expirado", "semToken", "tenant", "usuarioAusente"})
    void tokensInvalidosNaoAcessamContexto(String caso) {
        String token = switch (caso) {
            case "invalido" -> "Bearer token-invalido";
            case "assinatura" -> "Bearer " + new JwtService("abcdefghijklmnopqrstuvwxyz123456", 60000).gerarToken(1L,"12345678909",empresa,PerfilUsuario.ADMIN);
            case "expirado" -> assinar(System.currentTimeMillis() - 60000, System.currentTimeMillis() - 120000);
            case "tenant" -> "Bearer " + jwt.gerarToken(pessoas.get(PerfilUsuario.ADMIN).getId(),"12345678909",outraEmpresa,PerfilUsuario.ADMIN);
            case "usuarioAusente" -> "Bearer " + jwt.gerarToken(999999L,"12345678909",empresa,PerfilUsuario.ADMIN);
            default -> null;
        };
        assertThat(get(token, "/audit-auth/contexto").getStatusCode().value()).isEqualTo(401);
    }

    @Test void renovacaoPreservaInicioSessaoELimiteTotal() throws Exception {
        String token = token(PerfilUsuario.ADMIN);
        var resposta = exchange(token, "/auth/renovar", HttpMethod.POST, null);
        assertThat(resposta.getStatusCode().value()).isEqualTo(200);
        String novo = json.readTree(resposta.getBody()).path("token").asText();
        assertThat(jwt.extrairClaims(novo).get(JwtService.CLAIM_INICIO_SESSAO)).isEqualTo(jwt.extrairClaims(token.substring(7)).get(JwtService.CLAIM_INICIO_SESSAO));
        assertThat(get("Bearer " + novo, "/audit-auth/contexto").getStatusCode().value()).isEqualTo(200);
        assertThat(exchange(assinar(System.currentTimeMillis() + 60000, System.currentTimeMillis() - 28860000), "/auth/renovar", HttpMethod.POST, null).getStatusCode().value()).isEqualTo(401);
    }

    @Test void flagsLegadasNulasMantemSemanticaAnterior() {
        jdbc.update("update usuario set ativo=null where id=?", pessoas.get(PerfilUsuario.ADMIN).getId());
        jdbc.update("update empresas set ativo=null where id=?", empresa);
        assertThat(get(token(PerfilUsuario.ADMIN), "/audit-auth/contexto").getStatusCode().value()).isEqualTo(200);
    }

    @Test void empresaExternaNaoPodeSerConsultadaPorParametrosOuToken() throws Exception {
        assertThat(get(token(PerfilUsuario.ADMIN), "/empresas/" + outraEmpresa).getStatusCode().value()).isEqualTo(404);
        assertThat(get(token(PerfilUsuario.ADMIN), "/financeiro/movimentacoes-financeiras?contaFinanceiraId=" + contaExterna).getStatusCode().value()).isEqualTo(404);
        String tokenB = "Bearer " + jwt.gerarToken(externo);
        var corpo = json.readTree(get(tokenB, "/financeiro/movimentacoes-financeiras?empresaId=" + empresa).getBody());
        assertThat(corpo.path("totalItems").asInt()).isZero();
        assertThat(get(tokenB, "/financeiro/caixas/sessoes/" + sessao + "/painel").getStatusCode().value()).isEqualTo(404);
    }

    @Test void concorrenciaMantemContextosERevogacaoSemCache() throws Exception {
        try (var executor = Executors.newFixedThreadPool(8)) {
            var tarefas = new ArrayList<Callable<ResponseEntity<String>>>();
            for (int i = 0; i < 8; i++) {
                String token = i % 2 == 0 ? token(PerfilUsuario.ADMIN) : "Bearer " + jwt.gerarToken(externo);
                tarefas.add(() -> get(token, "/audit-auth/contexto"));
            }
            var respostas = executor.invokeAll(tarefas);
            for (int i = 0; i < respostas.size(); i++) {
                var resposta = respostas.get(i).get(10, TimeUnit.SECONDS);
                assertThat(resposta.getStatusCode().value()).isEqualTo(200);
                assertThat(json.readTree(resposta.getBody()).path("empresaId").asLong()).isEqualTo(i % 2 == 0 ? empresa : outraEmpresa);
            }
            jdbc.update("update usuario set versao_token=1 where id=?", pessoas.get(PerfilUsuario.ADMIN).getId());
            for (var resposta : executor.invokeAll(tarefas.subList(0,1)))
                assertThat(resposta.get().getStatusCode().value()).isEqualTo(401);
        }
    }

    @Test void contextoCompactoNaoCarregaUsuarioEmpresaOuLogomarca() {
        var resposta = get(token(PerfilUsuario.ADMIN), "/audit-auth/contexto");
        assertThat(resposta.getStatusCode().value()).isEqualTo(200);
        assertThat(resposta.getHeaders().getFirst("X-Test-Auth-Statements")).isEqualTo("1");
        assertThat(resposta.getHeaders().getFirst("X-Test-Auth-Entities")).isEqualTo("0");
        assertThat(resposta.getBody()).doesNotContain("logomarca", "senha", "versaoToken");
    }

    @Test void logomarcaPermaneceNoLoginEDetalheDaEmpresa() throws Exception {
        var detalhe = get(token(PerfilUsuario.ADMIN), "/empresas/" + empresa);
        assertThat(detalhe.getStatusCode().value()).isEqualTo(200);
        assertThat(json.readTree(detalhe.getBody()).path("logomarca").asText()).isEqualTo(LOGO);
        assertThat(json.readTree(login("12345678909",SENHA).getBody()).path("empresa").path("logomarca").asText()).isEqualTo(LOGO);
        jdbc.update("update empresas set logomarca=null where id=?", empresa);
        assertThat(json.readTree(login("12345678909",SENHA).getBody()).path("empresa").path("logomarca").isNull()).isTrue();
    }

    @Test void medirAutenticacaoEEndpointsComESemLogomarca() throws Exception {
        String pasta = System.getProperty("novexa.test.auth.evidence-dir");
        Assumptions.assumeTrue(pasta != null, "Medição opcional exige diretório privado de evidências.");
        String controle = System.getProperty("novexa.test.auth.proxy-control");
        var resultados = new ArrayList<Map<String,Object>>();
        for (boolean logo : List.of(false,true)) {
            jdbc.update("update empresas set logomarca=? where id=?", logo ? LOGO : null, empresa);
            var rotas = new LinkedHashMap<String,String>();
            for (var perfil : PerfilUsuario.values()) rotas.put("contexto_" + perfil.name(), "/audit-auth/contexto");
            rotas.put("resumo", "/financeiro/contas-financeiras/resumo");
            rotas.put("extrato25", "/financeiro/movimentacoes-financeiras?contaFinanceiraId=" + conta + "&size=25");
            rotas.put("painel", "/financeiro/caixas/sessoes/" + sessao + "/painel");
            rotas.put("empresa", "/empresas/" + empresa);
            rotas.put("login", "/auth/login");
            for (var rota : rotas.entrySet()) {
                var perfil = rota.getKey().startsWith("contexto_") ? PerfilUsuario.valueOf(rota.getKey().substring(9)) : PerfilUsuario.ADMIN;
                String token = token(perfil); var amostras = new ArrayList<Map<String,Object>>();
                for (int i = 0; i < 6; i++) {
                    if (controle != null) controle(controle + "/reset");
                    long inicio = System.nanoTime();
                    var resposta = rota.getKey().equals("login") ? login("12345678909",SENHA) : get(token,rota.getValue());
                    double tempo = (System.nanoTime()-inicio)/1_000_000.0;
                    assertThat(resposta.getStatusCode().value()).as(rota.getKey()).isEqualTo(200);
                    var amostra = new LinkedHashMap<String,Object>(); amostra.put("httpMs",tempo);
                    amostra.put("jsonBytes",resposta.getBody().getBytes(StandardCharsets.UTF_8).length);
                    amostra.put("authNanos",resposta.getHeaders().getFirst("X-Test-Auth-Nanos"));
                    amostra.put("authStatements",resposta.getHeaders().getFirst("X-Test-Auth-Statements"));
                    amostra.put("authEntities",resposta.getHeaders().getFirst("X-Test-Auth-Entities"));
                    if (controle != null) amostra.put("database", json.readTree(controle(controle + "/snapshot")));
                    if (i > 0) amostras.add(amostra);
                    var corpo = json.readTree(resposta.getBody());
                    if (rota.getKey().equals("login")) ((com.fasterxml.jackson.databind.node.ObjectNode) corpo).remove("token");
                    json.writeValue(Path.of(pasta,(logo ? "logo-" : "null-")+rota.getKey()+"-response.json").toFile(),corpo);
                }
                resultados.add(Map.of("case",rota.getKey(),"logo",logo,"samples",amostras));
                json.writeValue(Path.of(pasta,"metrics.json").toFile(),resultados);
            }
        }
    }
    String controle(String url) throws IOException { try (var stream = URI.create(url).toURL().openStream()) { return new String(stream.readAllBytes(),StandardCharsets.UTF_8); } }
    String token(PerfilUsuario perfil) { return "Bearer " + jwt.gerarToken(pessoas.get(perfil)); }
    String assinar(long expiracao, long inicio) {
        return "Bearer " + Jwts.builder().claim("usuarioId",pessoas.get(PerfilUsuario.ADMIN).getId()).claim("cpf","12345678909")
                .claim("empresaId",empresa).claim("perfil","ADMIN").claim("inicioSessao",inicio)
                .issuedAt(new Date(inicio)).expiration(new Date(expiracao)).signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
    }
    ResponseEntity<String> get(String token,String path) { return exchange(token,path,HttpMethod.GET,null); }
    ResponseEntity<String> login(String cpf,String senha) { return exchange(null,"/auth/login",HttpMethod.POST,Map.of("cpf",cpf,"senha",senha)); }
    ResponseEntity<String> exchange(String token,String path,HttpMethod method,Object body) {
        var headers = new HttpHeaders(); if (token != null) headers.setBearerAuth(token.substring(7));
        return http.exchange(path,method,new HttpEntity<>(body,headers),String.class);
    }
    EmpresaEntity empresa(String nome,String logo) { var e = new EmpresaEntity(); e.setRazaoSocial(nome);e.setNomeFantasia(nome);e.setAtivo(true);e.setLogomarca(logo);return empresas.saveAndFlush(e); }
    UsuarioEntity usuario(EmpresaEntity e,PerfilUsuario perfil,String cpf,String hash) {
        var p = new UsuarioEntity();p.setEmpresa(e);p.setNomeUsuario(perfil.name());p.setPerfil(perfil);p.setCpf(cpf);p.setSenha(hash);return usuarios.saveAndFlush(p);
    }
    long conta(long tenant) {
        return jdbc.queryForObject("insert into contas_financeiras(empresa_id,nome,tipo,saldo_inicial,saldo_atual,ativo,data_criacao,data_atualizacao) values (?,'Conta sintética','OUTROS',0,0,true,timestamp '2026-10-19 10:00',timestamp '2026-10-19 10:00') returning id",Long.class,tenant);
    }

    @RestController static class ContextoController {
        @GetMapping("/audit-auth/contexto") Map<String,Object> contexto(@AuthenticationPrincipal UsuarioAutenticado p,Authentication a) {
            return Map.of("usuarioId",p.usuarioId(),"empresaId",p.empresaId(),"cpf",p.cpf(),"perfil",p.perfil(),"autoridade",a.getAuthorities().iterator().next().getAuthority());
        }
    }
    /** Subclasse só de teste: mede até a chamada downstream, executando o filtro original integralmente. */
    static class FiltroMedido extends JwtAuthenticationFilter {
        final org.hibernate.stat.Statistics stats;
        FiltroMedido(JwtService jwt,UsuarioRepository usuarios,EntityManagerFactory emf) {
            super(jwt,new SecurityErrorHandler(),usuarios);stats=emf.unwrap(SessionFactory.class).getStatistics();
        }
        @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain) throws ServletException,IOException {
            long inicio=System.nanoTime(), consultas=stats.getPrepareStatementCount(), entidades=stats.getEntityLoadCount();
            super.doFilterInternal(req,res,(r,s)->{
                res.setHeader("X-Test-Auth-Nanos",Long.toString(System.nanoTime()-inicio));
                res.setHeader("X-Test-Auth-Statements",Long.toString(stats.getPrepareStatementCount()-consultas));
                res.setHeader("X-Test-Auth-Entities",Long.toString(stats.getEntityLoadCount()-entidades));
                chain.doFilter(r,s);
            });
        }
    }
    @TestConfiguration(proxyBeanMethods=false) static class MedicaoConfig {
        @Bean static BeanPostProcessor medir(ObjectProvider<JwtService> jwt,ObjectProvider<UsuarioRepository> usuarios,ObjectProvider<EntityManagerFactory> emf) {
            return new BeanPostProcessor() {
                @Override public Object postProcessAfterInitialization(Object bean,String name) {
                    if (bean instanceof DefaultSecurityFilterChain cadeia) {
                        var filtros = cadeia.getFilters().stream().map(f -> f instanceof JwtAuthenticationFilter
                                ? (Filter) new FiltroMedido(jwt.getObject(),usuarios.getObject(),emf.getObject()) : f).toList();
                        return new DefaultSecurityFilterChain(cadeia.getRequestMatcher(),filtros);
                    }
                    return bean;
                }
            };
        }
    }
}
