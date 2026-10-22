package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.entity.PerfilUsuario;
import br.com.novexa.erp.support.AutenticacaoTeste;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

@EnabledIfSystemProperty(named = "novexa.test.clientes.jdbc-url",
        matches = "jdbc:postgresql://(?:127\\.0\\.0\\.1|localhost):[0-9]+/novexa_clientes_test")
@Import({ClienteHttpTest.FalhaController.class, ClienteConcorrenciaPostgresTest.IntegridadeController.class,
        ClienteConcorrenciaPostgresTest.IntegridadeRepository.class})
class ClienteConcorrenciaPostgresTest extends ClienteHttpTest {
    private static final String SCHEMA = "clientes_" + UUID.randomUUID().toString().replace("-", "");
    private static final String CPF = "52998224725";

    @DynamicPropertySource
    static void postgres(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", () -> System.getProperty("novexa.test.clientes.jdbc-url") + "?currentSchema=" + SCHEMA);
        p.add("spring.datasource.username", () -> "postgres");
        p.add("spring.datasource.password", () -> "");
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        p.add("spring.flyway.enabled", () -> "true");
        p.add("spring.flyway.schemas", () -> SCHEMA);
        p.add("spring.flyway.default-schema", () -> SCHEMA);
    }

    @Autowired JdbcTemplate jdbc;

    @RepeatedTest(3)
    void oitoCadastrosSimultaneosPersistemUmClienteERetornamSeteConflitos() throws Exception {
        var headers = headers();
        List<ResponseEntity<String>> respostas = new ArrayList<>();
        try (var executor = Executors.newFixedThreadPool(8);
             var bloqueio = jdbc.getDataSource().getConnection()) {
            assertThat(bloqueio.getSchema()).isEqualTo(SCHEMA);
            bloqueio.setAutoCommit(false);
            List<Future<ResponseEntity<String>>> tarefas = new ArrayList<>();
            try {
                // Permite as pré-validações reais e segura os INSERTs até os oito chegarem ao PostgreSQL.
                try (var comando = bloqueio.createStatement()) { comando.execute("LOCK TABLE clientes IN SHARE MODE"); }
                for (int i = 0; i < 8; i++) {
                    var pedido = dados("Concorrente " + i, i % 2 == 0 ? CPF : "529.982.247-25");
                    tarefas.add(executor.submit(() -> http.exchange("/clientes", HttpMethod.POST,
                            new HttpEntity<>(pedido, headers), String.class)));
                }
                await().atMost(Duration.ofSeconds(15)).untilAsserted(() ->
                        assertThat(jdbc.queryForObject("SELECT count(*) FROM pg_locks WHERE relation='clientes'::regclass "
                                + "AND mode='RowExclusiveLock' AND NOT granted", Long.class)).isEqualTo(8L));
            } finally {
                bloqueio.rollback(); // Libera somente o bloqueio de teste, inclusive em caso de falha.
            }
            for (var tarefa : tarefas) respostas.add(tarefa.get(30, TimeUnit.SECONDS));
        }

        assertThat(respostas).filteredOn(r -> r.getStatusCode() == HttpStatus.CREATED).hasSize(1);
        assertThat(respostas).filteredOn(r -> r.getStatusCode() == HttpStatus.CONFLICT).hasSize(7)
                .allSatisfy(r -> {
                    assertThat(r.getBody()).contains("CPF/CNPJ", "cadastro existente")
                            .doesNotContain("uk_cliente", "23505", "SQL", CPF, "529.982.247-25");
                    assertThat(r.getHeaders().getFirst(HttpHeaders.WWW_AUTHENTICATE)).isNull();
                });
        assertThat(jdbc.queryForObject("SELECT count(*) FROM clientes", Long.class)).isEqualTo(1L);
        assertThat(jdbc.queryForObject("SELECT cpf_cnpj FROM clientes", String.class)).isEqualTo(CPF);
    }

    @Test
    void mesmoDocumentoEmEmpresasDiferentesContinuaPermitidoSemVazamento() throws Exception {
        var primeira = http.exchange("/clientes", HttpMethod.POST,
                new HttpEntity<>(dados("Tenant A", CPF), headers()), String.class);
        assertThat(primeira.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        var outra = new EmpresaEntity(); outra.setRazaoSocial("Outro tenant sintético"); outra.setAtivo(true);
        empresas.saveAndFlush(outra);
        var headersOutra = new HttpHeaders(); headersOutra.setContentType(MediaType.APPLICATION_JSON);
        headersOutra.set(HttpHeaders.AUTHORIZATION,
                AutenticacaoTeste.token(usuarios, jwt, outra, PerfilUsuario.USUARIO, "11144477735"));
        assertThat(http.exchange("/clientes", HttpMethod.POST,
                new HttpEntity<>(dados("Tenant B", CPF), headersOutra), String.class).getStatusCode())
                .isEqualTo(HttpStatus.CREATED);
        long id = json.readTree(primeira.getBody()).get("id").asLong();
        assertThat(http.exchange("/clientes/" + id, HttpMethod.GET,
                new HttpEntity<>(headersOutra), String.class).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(jdbc.queryForObject("SELECT count(DISTINCT empresa_id) FROM clientes WHERE cpf_cnpj=?",
                Long.class, CPF)).isEqualTo(2L);
    }

    @Test
    void outrasViolacoesReaisDeUnicidadeEChaveEstrangeiraContinuam500SemDetalhesInternos() throws Exception {
        var criado = http.exchange("/clientes", HttpMethod.POST,
                new HttpEntity<>(dados("Cliente preservado", CPF), headers()), String.class);
        assertThat(criado.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        long id = json.readTree(criado.getBody()).get("id").asLong();
        for (String tipo : List.of("unicidade", "fk")) {
            var resposta = http.exchange("/teste/clientes/integridade/" + tipo + "?id=" + id,
                    HttpMethod.GET, new HttpEntity<>(headers()), String.class);
            assertThat(resposta.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
            assertThat(resposta.getBody()).contains("X-Request-ID")
                    .doesNotContain("CPF/CNPJ", "clientes_pkey", "fk_cliente_empresa", "SQL", "23505", "23503");
        }
        assertThat(clientes.count()).isEqualTo(1);
    }

    private HttpHeaders headers() {
        var headers = new HttpHeaders(); headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + jwt.gerarToken(usuarios.findAll().getFirst()));
        return headers;
    }

    private Map<String, Object> dados(String nome, String cpf) {
        return Map.of("nome", nome, "tipoPessoa", "FISICA", "cpfCnpj", cpf,
                "enderecos", List.of(), "contatos", List.of());
    }

    @RestController
    static class IntegridadeController {
        private final IntegridadeRepository repositorio;
        IntegridadeController(IntegridadeRepository repositorio) { this.repositorio = repositorio; }
        @GetMapping("/teste/clientes/integridade/{tipo}")
        void violar(@PathVariable String tipo, @RequestParam long id) { repositorio.violar(tipo, id); }
    }

    @Repository
    static class IntegridadeRepository {
        @Autowired EntityManager em;
        @Transactional
        public void violar(String tipo, long id) {
            if ("unicidade".equals(tipo)) {
                em.createNativeQuery("INSERT INTO clientes(id,empresa_id,nome,tipo_pessoa,data_cadastro) "
                        + "SELECT id,empresa_id,'Duplicado sintético','FISICA',CURRENT_TIMESTAMP FROM clientes WHERE id=:id")
                        .setParameter("id", id).executeUpdate();
            } else {
                em.createNativeQuery("INSERT INTO clientes(empresa_id,nome,tipo_pessoa,data_cadastro) "
                        + "VALUES(-1,'FK sintética','FISICA',CURRENT_TIMESTAMP)").executeUpdate();
            }
        }
    }
}
