package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.CaixaOperacionalService;
import br.com.novexa.erp.service.UsuarioService;
import jakarta.persistence.EntityManager;
import org.hibernate.Hibernate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:performance-guardrails;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.show-sql=false",
        "novexa.jwt.secret=01234567890123456789012345678901",
        "novexa.jwt.expiration-ms=60000"
})
@Import(PerformanceGuardrailsH2Test.SqlCaptureConfiguration.class)
@org.springframework.boot.test.autoconfigure.actuate.observability.AutoConfigureObservability
class PerformanceGuardrailsH2Test {

    static final List<String> EXECUTED_SQL = new CopyOnWriteArrayList<>();
    static final AtomicLong TEXT_BYTES = new AtomicLong();
    private static final AtomicLong CNPJ_SEQ = new AtomicLong(77889900000100L);
    private static final AtomicLong CPF_SEQ = new AtomicLong(73000000000L);

    @Autowired EntityManager em;
    @Autowired PlatformTransactionManager tm;
    @Autowired EmpresaRepository empresaRepository;
    @Autowired UsuarioRepository usuarioRepository;
    @Autowired CaixaRepository caixaRepository;
    @Autowired SessaoCaixaRepository sessaoCaixaRepository;
    @Autowired PagamentoRepository pagamentoRepository;
    @Autowired MovimentacaoCaixaRepository movimentacaoCaixaRepository;
    @Autowired CaixaOperacionalService caixaOperacionalService;
    @Autowired UsuarioService usuarioService;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired org.springframework.boot.test.web.client.TestRestTemplate http;
    @Autowired io.micrometer.core.instrument.MeterRegistry meters;

    private static final String SINTETICO_LOGO = "data:image/png;base64," + "A".repeat(971_611);

    private EmpresaEntity empresa;
    private UsuarioEntity usuario;
    private SessaoCaixaEntity sessao;
    private String cpfAtual;

    @BeforeEach
    void prepararCenario() {
        EXECUTED_SQL.clear();
        String cnpj = String.valueOf(CNPJ_SEQ.incrementAndGet());
        cpfAtual = String.valueOf(CPF_SEQ.incrementAndGet());

        new TransactionTemplate(tm).executeWithoutResult(status -> {
            empresa = new EmpresaEntity();
            empresa.setRazaoSocial("Guardrail Tech Comércio Ltda");
            empresa.setNomeFantasia("Guardrail Tech");
            empresa.setCnpj(cnpj);
            empresa.setLogomarca(SINTETICO_LOGO);
            empresa.setAtivo(true);
            empresa = empresaRepository.save(empresa);

            usuario = new UsuarioEntity();
            usuario.setEmpresa(empresa);
            usuario.setNomeUsuario("Operador Guardrail");
            usuario.setCpf(cpfAtual);
            usuario.setSenha(passwordEncoder.encode("senha123"));
            usuario.setPerfil(PerfilUsuario.OPERADOR);
            usuario.setAtivo(true);
            usuario = usuarioRepository.save(usuario);

            CaixaEntity caixa = new CaixaEntity();
            caixa.setEmpresa(empresa);
            caixa.setDescricao("Caixa 01");
            caixa.setAtivo(true);
            caixa = caixaRepository.save(caixa);

            sessao = new SessaoCaixaEntity(caixa, usuario, BigDecimal.valueOf(100.00));
            sessao = sessaoCaixaRepository.save(sessao);
        });
        EXECUTED_SQL.clear();
    }

    @Test
    void metricasHttpColetamContagemELatenciaSemExposicaoPublica() {
        assertThat(http.getForEntity("/actuator/metrics", String.class).getStatusCode().value()).isEqualTo(401);
        assertThat(http.getForEntity("/actuator/health", String.class).getStatusCode().value()).isEqualTo(200);
        var timers = meters.find("http.server.requests").timers();
        assertThat(timers).isNotEmpty();
        assertThat(timers.stream().mapToLong(io.micrometer.core.instrument.Timer::count).sum()).isPositive();
        assertThat(timers.stream().mapToDouble(t -> t.totalTime(java.util.concurrent.TimeUnit.NANOSECONDS)).sum()).isPositive();
        assertThat(timers).anySatisfy(t -> assertThat(t.getId().getTag("status")).isEqualTo("401"));
        assertThat(timers).allSatisfy(t -> assertThat(t.getId().getTags()).noneSatisfy(tag ->
                assertThat(tag.getKey()).isIn("cpf", "jwt", "authorization", "empresaId", "usuarioId")));
    }

    @Test
    void painelCaixaNaoCarregaLogomarcaNemUsaLocksPessimistas() {
        var usuarioAuth = new UsuarioAutenticado(usuario.getId(), usuario.getCpf(), empresa.getId(), usuario.getPerfil());

        EXECUTED_SQL.clear();
        TEXT_BYTES.set(0);
        var painel = caixaOperacionalService.painel(sessao.getId(), usuarioAuth);

        assertThat(painel).isNotNull();
        assertThat(painel.resumo().saldoInicial()).isEqualByComparingTo(BigDecimal.valueOf(100.00));

        // Nenhuma consulta executada pelo painel deve buscar o campo logomarca
        long queriesComLogomarca = EXECUTED_SQL.stream()
                .filter(sql -> sql.toLowerCase(Locale.ROOT).contains("logomarca"))
                .count();
        assertThat(queriesComLogomarca)
                .as("O painel de Caixa não pode carregar o Base64 da logomarca")
                .isZero();

        // O painel deve ser puramente de leitura, sem locks pessimistas
        long queriesComLock = EXECUTED_SQL.stream()
                .filter(sql -> {
                    String lower = sql.toLowerCase(Locale.ROOT);
                    return lower.contains("for update") || lower.contains("for no key update");
                })
                .count();
        assertThat(queriesComLock)
                .as("Consultas do painel devem ser read-only e livres de lock pessimista")
                .isZero();

        // Referência local: 6 consultas. Uma de folga permite evolução sem voltar às 10 legadas.
        assertThat(EXECUTED_SQL.size())
                .as("Painel de Caixa deve executar poucas consultas (teto de 7)")
                .isLessThanOrEqualTo(7);
        // Fixture mínima: orçamento amplo, mas inferior a uma única imagem (~972 KB).
        // Bytes de texto decodificado JDBC, não bytes de rede nem egress faturado.
        assertThat(TEXT_BYTES.get()).isLessThan(128 * 1024L);
    }

    @Test
    void entidadeEmpresaMantemLogomarcaLazyAteAcessoExplicito() {
        var tx = new TransactionTemplate(tm);
        tx.executeWithoutResult(status -> {
            EXECUTED_SQL.clear();
            EmpresaEntity e = em.find(EmpresaEntity.class, empresa.getId());
            assertThat(e).isNotNull();

            // Bytecode enhancement garante que logomarca não foi carregada
            assertThat(Hibernate.isPropertyInitialized(e, "logomarca"))
                    .as("Propriedade logomarca deve permanecer LAZY após find()")
                    .isFalse();

            long selectsComLogoAntes = EXECUTED_SQL.stream()
                    .filter(sql -> sql.toLowerCase(Locale.ROOT).contains("logomarca"))
                    .count();
            assertThat(selectsComLogoAntes).isZero();

            // Ao chamar explicitamente getLogomarca(), o carregamento sob demanda deve ocorrer
            String logo = e.getLogomarca();
            assertThat(logo).isEqualTo(SINTETICO_LOGO);
            assertThat(Hibernate.isPropertyInitialized(e, "logomarca")).isTrue();

            long selectsComLogoDepois = EXECUTED_SQL.stream()
                    .filter(sql -> sql.toLowerCase(Locale.ROOT).contains("logomarca"))
                    .count();
            assertThat(selectsComLogoDepois)
                    .as("Acesso explícito deve consultar a logomarca sob demanda")
                    .isGreaterThan(0);
        });
    }

    @Test
    void alterarOutroCampoSemLerImagemPreservaConteudoNoBanco() {
        var tx = new TransactionTemplate(tm);
        tx.executeWithoutResult(status -> {
            EXECUTED_SQL.clear();
            EmpresaEntity e = em.find(EmpresaEntity.class, empresa.getId());
            assertThat(Hibernate.isPropertyInitialized(e, "logomarca")).isFalse();
            e.setNomeFantasia("Nome Atualizado Guardrail");
        });

        // Conferir no banco que o conteúdo original foi preservado intacto sem ser transferido
        tx.executeWithoutResult(status -> {
            EmpresaEntity recarregada = em.find(EmpresaEntity.class, empresa.getId());
            assertThat(recarregada.getNomeFantasia()).isEqualTo("Nome Atualizado Guardrail");
            assertThat(Hibernate.isPropertyInitialized(recarregada, "logomarca")).isFalse();
            assertThat(recarregada.getLogomarca()).isEqualTo(SINTETICO_LOGO);
        });
    }

    @Test
    void loginCarregaLogomarcaPorContratoMasContextoSegurancaPermaneceLeve() {
        // 1. Login inicial (contrato da aplicação exige imagem da empresa para o frontend)
        UsuarioEntity usuarioAutenticado = usuarioService.autenticar(cpfAtual, "senha123");
        assertThat(usuarioAutenticado).isNotNull();
        assertThat(usuarioAutenticado.getEmpresa().getLogomarca()).isEqualTo(SINTETICO_LOGO);

        // 2. Consulta de segurança subsequente do JWT (feita em cada requisição autenticada)
        EXECUTED_SQL.clear();
        var contexto = usuarioRepository.buscarContextoSeguranca(usuario.getId(), empresa.getId());
        assertThat(contexto).isPresent();

        long selectsComLogoNoContexto = EXECUTED_SQL.stream()
                .filter(sql -> sql.toLowerCase(Locale.ROOT).contains("logomarca"))
                .count();
        assertThat(selectsComLogoNoContexto)
                .as("buscarContextoSeguranca() não pode selecionar logomarca")
                .isZero();
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class SqlCaptureConfiguration {
        @Bean
        static BeanPostProcessor interceptarDataSource() {
            return new BeanPostProcessor() {
                @Override
                public Object postProcessAfterInitialization(Object bean, String name) {
                    if (bean instanceof DataSource ds) {
                        return proxy(DataSource.class, ds, (method, args, value) ->
                                value instanceof Connection c ? connectionProxy(c) : value);
                    }
                    return bean;
                }
            };
        }

        private static Connection connectionProxy(Connection connection) {
            return proxy(Connection.class, connection, (m, a, v) -> {
                if (m.getName().equals("prepareStatement") && v instanceof PreparedStatement ps) {
                    String sql = (String) a[0];
                    return proxy(PreparedStatement.class, ps, (pm, pa, pv) -> {
                        if (pm.getName().equals("executeQuery") && pv instanceof ResultSet) {
                            EXECUTED_SQL.add(sql);
                            return proxy(ResultSet.class, (ResultSet) pv, (rm, ra, rv) -> {
                                if (rm.getName().equals("getString") && rv instanceof String text) {
                                    TEXT_BYTES.addAndGet(text.getBytes(java.nio.charset.StandardCharsets.UTF_8).length);
                                }
                                return rv;
                            });
                        }
                        return pv;
                    });
                }
                return v;
            });
        }

        interface InvocationHandlerHook {
            Object apply(Method method, Object[] args, Object value) throws Throwable;
        }

        @SuppressWarnings("unchecked")
        private static <T> T proxy(Class<T> type, T target, InvocationHandlerHook hook) {
            return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, (p, m, a) -> {
                try {
                    Object result = m.invoke(target, a);
                    return hook.apply(m, a, result);
                } catch (InvocationTargetException e) {
                    throw e.getCause();
                }
            });
        }
    }
}
