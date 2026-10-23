package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.MovimentacaoFinanceiraResponseDTO;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.service.ContaFinanceiraService;
import br.com.novexa.erp.service.JwtService;
import br.com.novexa.erp.support.AutenticacaoTeste;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.function.Predicate;
import static org.assertj.core.api.Assertions.*;

/** HTTP real e schema isolado: contrato anterior como oráculo e budget independente do tamanho da página. */
@EnabledIfSystemProperty(named = "novexa.test.extrato.jdbc-url",
        matches = "jdbc:postgresql://(?:127\\.0\\.0\\.1|localhost):[0-9]+/novexa_extrato_performance_test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.jpa.open-in-view=false", "spring.jpa.show-sql=false",
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "logging.level.org.hibernate.engine.internal.StatisticalLoggingSessionEventListener=OFF",
        "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=600000",
        "supabase.url=http://127.0.0.1:9", "supabase.secret-key=synthetic-test-only", "supabase.bucket=local",
        "novexa.geocoding.url="
})
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ExtratoFinanceiroPostgresTest {
    static final String URL = System.getProperty("novexa.test.extrato.jdbc-url");
    static final String SCHEMA = "extrato_" + UUID.randomUUID().toString().replace("-", "");
    static final Comparator<MovimentacaoFinanceiraResponseDTO> PADRAO =
            Comparator.comparing(MovimentacaoFinanceiraResponseDTO::dataMovimento).reversed()
                    .thenComparing(MovimentacaoFinanceiraResponseDTO::id, Comparator.reverseOrder());
    @DynamicPropertySource static void postgres(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", () -> URL + "?currentSchema=" + SCHEMA);
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
    @Autowired ContaFinanceiraService service;
    @Autowired EntityManagerFactory emf;
    final Map<PerfilUsuario, String> tokens = new EnumMap<>(PerfilUsuario.class);
    List<MovimentacaoFinanceiraResponseDTO> anteriores;
    long empresa, conta, destino, contaExterna;
    String externo;

    @BeforeAll void preparar() {
        var e = new EmpresaEntity(); e.setRazaoSocial("Extrato sintético"); e.setAtivo(true);
        e.setLogomarca("x".repeat(971611)); e = empresas.saveAndFlush(e); empresa = e.getId();
        long cpf = 74000000000L;
        for (var perfil : PerfilUsuario.values())
            tokens.put(perfil, AutenticacaoTeste.token(usuarios, jwt, e, perfil, Long.toString(++cpf)));
        long usuario = jdbc.queryForObject("select id from usuario where empresa_id=? and perfil='ADMIN'", Long.class, empresa);
        var outra = new EmpresaEntity(); outra.setRazaoSocial("Outro tenant"); outra.setAtivo(true);
        outra = empresas.saveAndFlush(outra);
        externo = AutenticacaoTeste.token(usuarios, jwt, outra, PerfilUsuario.ADMIN, Long.toString(++cpf));
        contaExterna = conta(outra.getId(), "Conta externa");
        conta = conta(empresa, "Origem");
        for (int i = 0; i < 60; i++) {
            long contraparte = conta(empresa, "Destino " + i);
            if (i == 0) destino = contraparte;
            BigDecimal valor = new BigDecimal("1.25").add(BigDecimal.valueOf(i));
            LocalDate data = LocalDate.of(2026, 10, 19 + i % 3);
            long transferencia = jdbc.queryForObject("""
                    insert into transferencias_financeiras(empresa_id,conta_origem_id,conta_destino_id,valor,
                        data_movimento,observacao,usuario_id,status,chave_requisicao,data_criacao)
                    values (?,?,?,?,?,'Observação preservada',?,'CONCLUIDA',?,timestamp '2026-10-19 10:00') returning id
                    """, Long.class, empresa, conta, contraparte, valor, data, usuario, UUID.randomUUID());
            for (String tipo : List.of("SAIDA", "ENTRADA"))
                jdbc.update("""
                        insert into movimentacoes_financeiras(empresa_id,conta_financeira_id,tipo,origem,descricao,
                            valor,data_movimento,observacao,usuario_id,data_criacao,estornada,transferencia_id)
                        values (?,?,?,'TRANSFERENCIA',?,?,?,'Observação preservada',?,timestamp '2026-10-19 10:00',false,?)
                        """, empresa, tipo.equals("SAIDA") ? conta : contraparte, tipo,
                        tipo.equals("SAIDA") ? "Transferência enviada" : "Transferência recebida", valor, data, usuario, transferencia);
            if (i == 0) {
                jdbc.update("""
                        update transferencias_financeiras set status='ESTORNADA',data_estorno=timestamp '2026-10-22 10:00',
                            usuario_estorno_id=?,motivo_estorno='Estorno de teste' where id=?
                        """, usuario, transferencia);
                jdbc.update("""
                        update movimentacoes_financeiras set estornada=true,data_estorno=timestamp '2026-10-22 10:00',
                            usuario_estorno_id=?,motivo_estorno='Estorno de teste' where transferencia_id=?
                        """, usuario, transferencia);
            }
        }
        jdbc.update("""
                insert into movimentacoes_financeiras(empresa_id,conta_financeira_id,tipo,origem,descricao,valor,
                    data_movimento,usuario_id,data_criacao,estornada)
                select ?,?,case when i%2=0 then 'ENTRADA' else 'SAIDA' end,'MANUAL','Manual '||i,i,
                    date '2026-10-19'+(i%3),?,timestamp '2026-10-19 11:00',false from generate_series(1,60)i
                """, empresa, conta, usuario);
        long cliente = jdbc.queryForObject("insert into clientes(empresa_id,nome,tipo_pessoa,ativo,data_cadastro) values (?,'Cliente sintético','FISICA',true,current_date) returning id", Long.class, empresa);
        long titulo = jdbc.queryForObject("""
                insert into contas_receber(empresa_id,cliente_id,descricao,valor_original,valor_recebido,data_vencimento,
                    status,origem,numero_parcela,total_parcelas,data_criacao,data_atualizacao)
                values (?,?,'Recebimento sintético',10,10,date '2026-10-19','RECEBIDA','MANUAL',1,1,now(),now()) returning id
                """, Long.class, empresa, cliente);
        jdbc.update("""
                insert into movimentacoes_financeiras(empresa_id,conta_financeira_id,tipo,origem,descricao,valor,
                    data_movimento,usuario_id,data_criacao,estornada,conta_receber_id,chave_requisicao)
                values (?,?,'ENTRADA','CONTA_RECEBER','Recebimento sintético',10,date '2026-10-19',?,now(),false,?,?)
                """, empresa, conta, usuario, titulo, UUID.randomUUID());
        adicionarLiquidacaoEPix(usuario);
        jdbc.update("""
                update contas_financeiras c set saldo_atual=saldo_inicial+coalesce((select sum(
                    case when m.tipo='ENTRADA' then m.valor else -m.valor end) from movimentacoes_financeiras m
                    where m.conta_financeira_id=c.id and not m.estornada),0) where empresa_id=?
                """, empresa);
        // Caminho anterior de entidades/DTO::de, preservado para escritas e leituras não paginadas.
        anteriores = service.listarMovimentos(empresa, null);
        assertThat(anteriores).hasSize(183);
    }

    @ParameterizedTest @ValueSource(ints = {10, 25, 50})
    void paginaManualOuTransferenciaEquivaleAoDtoAnterior(int tamanho) throws Exception {
        for (String origem : List.of("MANUAL", "TRANSFERENCIA")) {
            var filtro = (Predicate<MovimentacaoFinanceiraResponseDTO>) m -> m.contaFinanceiraId() == conta && m.origem().name().equals(origem);
            conferir("contaFinanceiraId=" + conta + "&origem=" + origem, filtro, PADRAO, 0, tamanho);
            conferir("contaFinanceiraId=" + conta + "&origem=" + origem, filtro, PADRAO, 1, tamanho);
        }
    }

    @ParameterizedTest @CsvSource({"id,asc", "id,desc", "dataMovimento,asc", "dataMovimento,desc",
            "valor,asc", "valor,desc", "tipo,asc", "tipo,desc", "origem,asc", "origem,desc"})
    void ordenacaoEstavelEquivaleAoContratoAnterior(String campo, String direcao) throws Exception {
        Comparator<MovimentacaoFinanceiraResponseDTO> ordem = switch (campo) {
            case "id" -> Comparator.comparing(MovimentacaoFinanceiraResponseDTO::id);
            case "dataMovimento" -> Comparator.comparing(MovimentacaoFinanceiraResponseDTO::dataMovimento);
            case "valor" -> Comparator.comparing(MovimentacaoFinanceiraResponseDTO::valor);
            case "tipo" -> Comparator.comparing(m -> m.tipo().name());
            default -> Comparator.comparing(m -> m.origem().name());
        };
        if (direcao.equals("desc")) ordem = ordem.reversed();
        ordem = ordem.thenComparing(MovimentacaoFinanceiraResponseDTO::id, Comparator.reverseOrder());
        conferir("sort=" + campo + "," + direcao, m -> true, ordem, 0, 25);
        conferir("sort=" + campo + "," + direcao, m -> true, ordem, 1, 25);
    }

    @Test void datasInclusivasContaSinaisContrapartesEstornosENulos() throws Exception {
        conferir("dataInicial=2026-10-20&dataFinal=2026-10-20", m -> m.dataMovimento().equals(LocalDate.of(2026,10,20)), PADRAO, 0, 50);
        conferir("dataInicial=2026-10-20", m -> !m.dataMovimento().isBefore(LocalDate.of(2026,10,20)), PADRAO, 0, 50);
        conferir("dataFinal=2026-10-20", m -> !m.dataMovimento().isAfter(LocalDate.of(2026,10,20)), PADRAO, 0, 50);
        conferir("contaFinanceiraId=" + destino, m -> m.contaFinanceiraId() == destino, PADRAO, 0, 10);
        conferir("estornada=true", MovimentacaoFinanceiraResponseDTO::estornada, PADRAO, 0, 25);
        conferir("estornada=false&tipo=SAIDA", m -> !m.estornada() && m.tipo() == TipoMovimentacaoFinanceira.SAIDA, PADRAO, 0, 25);
        conferir("origem=CONTA_RECEBER", m -> m.origem() == OrigemMovimentacaoFinanceira.CONTA_RECEBER, PADRAO, 0, 10);
        assertThat(anteriores).anySatisfy(m -> {
            assertThat(m.contaFinanceiraId()).isEqualTo(destino);
            assertThat(m.contaContraparteNome()).isEqualTo("Origem");
            assertThat(m.tipo()).isEqualTo(TipoMovimentacaoFinanceira.ENTRADA);
            assertThat(m.valor()).isEqualByComparingTo("1.25");
            assertThat(m.estornada()).isTrue(); assertThat(m.usuarioEstornoId()).isNotNull();
        });
    }

    @Test void consultasEEntidadesNaoCrescemComContrapartesOuTamanhoDaPagina() throws Exception {
        pagina(tokens.get(PerfilUsuario.ADMIN), "contaFinanceiraId=" + conta + "&origem=TRANSFERENCIA&size=10");
        var stats = emf.unwrap(SessionFactory.class).getStatistics();
        Long primeira = null;
        for (int tamanho : new int[]{10,25,50}) {
            stats.clear();
            var resposta = pagina(tokens.get(PerfilUsuario.ADMIN), "contaFinanceiraId=" + conta + "&origem=TRANSFERENCIA&size=" + tamanho);
            assertThat(resposta.path("items").size()).isEqualTo(tamanho);
            long consultas = stats.getPrepareStatementCount();
            assertThat(consultas).isLessThanOrEqualTo(5); // autenticação (2), existência, página e count.
            assertThat(stats.getEntityLoadCount()).isLessThanOrEqualTo(2); // só usuário/empresa da autenticação.
            if (primeira == null) primeira = consultas;
            else assertThat(consultas).isEqualTo(primeira);
        }
    }

    @Test void vinculosOpcionaisDePixELiquidacaoPreservamTodosOsCampos() throws Exception {
        conferir("origem=RECEBIVEL_LIQUIDACAO", m -> m.origem() == OrigemMovimentacaoFinanceira.RECEBIVEL_LIQUIDACAO, PADRAO, 0, 10);
        conferir("origem=PAGAMENTO_PIX", m -> m.origem() == OrigemMovimentacaoFinanceira.PAGAMENTO_PIX, PADRAO, 0, 10);
        assertThat(anteriores.stream().filter(m -> m.origem() == OrigemMovimentacaoFinanceira.RECEBIVEL_LIQUIDACAO))
                .singleElement().satisfies(m -> {
                    assertThat(m.recebivelId()).isNotNull();
                    assertThat(m.valor()).isEqualByComparingTo("20");
                    assertThat(m.transferenciaId()).isNull(); assertThat(m.contaContraparteNome()).isNull();
                });
    }

    @ParameterizedTest @EnumSource(PerfilUsuario.class)
    void todosOsPerfisMantemLeituraEIsolamento(PerfilUsuario perfil) throws Exception {
        var resposta = pagina(tokens.get(perfil), "size=50&empresaId=999999");
        assertThat(resposta.path("totalItems").asInt()).isEqualTo(183);
        assertThat(get(tokens.get(perfil), "contaFinanceiraId=" + contaExterna).getStatusCode().value()).isEqualTo(404);
        assertThat(get(externo, "contaFinanceiraId=" + conta).getStatusCode().value()).isEqualTo(404);
        assertThat(pagina(externo, "").path("totalItems").asInt()).isZero();
    }

    @Test void vazioPaginaExcedidaValidacoesEAutenticacao() throws Exception {
        conferir("", m -> true, PADRAO, 100, 25);
        conferir("dataFinal=2020-01-01", m -> false, PADRAO, 0, 25);
        for (String invalido : List.of("page=-1", "size=0", "size=101", "sort=empresa.id,asc",
                "sort=id,invalido", "dataInicial=2026-10-22&dataFinal=2026-10-19"))
            assertThat(get(tokens.get(PerfilUsuario.ADMIN), invalido).getStatusCode().value()).isEqualTo(400);
        assertThat(get(null, "").getStatusCode().value()).isEqualTo(401);
    }

    void conferir(String filtros, Predicate<MovimentacaoFinanceiraResponseDTO> filtro,
            Comparator<MovimentacaoFinanceiraResponseDTO> ordem, int pagina, int tamanho) throws Exception {
        var esperado = anteriores.stream().filter(filtro).sorted(ordem).toList();
        var resposta = pagina(tokens.get(PerfilUsuario.ADMIN), filtros + "&page=" + pagina + "&size=" + tamanho);
        assertThat(resposta.path("items")).isEqualTo(json.readTree(json.writeValueAsString(
                esperado.stream().skip((long) pagina * tamanho).limit(tamanho).toList())));
        assertThat(resposta.path("totalItems").asLong()).isEqualTo(esperado.size());
        assertThat(resposta.path("totalPages").asInt()).isEqualTo((esperado.size() + tamanho - 1) / tamanho);
        assertThat(resposta.path("page").asInt()).isEqualTo(pagina);
        assertThat(resposta.path("size").asInt()).isEqualTo(tamanho);
    }
    long conta(long tenant, String nome) {
        return jdbc.queryForObject("""
                insert into contas_financeiras(empresa_id,nome,tipo,saldo_inicial,saldo_atual,ativo,data_criacao,data_atualizacao)
                values (?,?,'OUTROS',10000,10000,true,now(),now()) returning id
                """, Long.class, tenant, nome);
    }
    void adicionarLiquidacaoEPix(long usuario) {
        long venda = jdbc.queryForObject("""
                insert into vendas(empresa_id,usuario_id,data_hora,data_faturamento,status,subtotal,desconto,total)
                values (?,?,timestamp '2026-10-19 10:00',timestamp '2026-10-19 10:00','FATURADA',27,0,27) returning id
                """, Long.class, empresa, usuario);
        for (String meio : List.of("CARTAO_CREDITO", "PIX")) {
            boolean cartao = meio.equals("CARTAO_CREDITO"); int valor = cartao ? 20 : 7;
            long pagamento = jdbc.queryForObject("""
                    insert into pagamentos(empresa_id,venda_id,usuario_id,sequencia,chave_requisicao,forma_pagamento,
                        forma_pagamento_id,valor,status,data_hora,configuracao_tipo,configuracao_conta_financeira_destino_id)
                    values (?,?,?,?,?,?,?,?,'REGISTRADO',timestamp '2026-10-19 10:00',?,?) returning id
                    """, Long.class, empresa, venda, usuario, cartao ? 1 : 2, UUID.randomUUID(), meio,
                    cartao ? 4 : 2, valor, cartao ? "CREDITO" : "PIX", conta);
            Long recebivel = cartao ? jdbc.queryForObject("""
                    insert into recebiveis(empresa_id,pagamento_id,venda_id,tipo,numero_parcela,total_parcelas,
                        valor_bruto,valor_liquido_previsto,data_venda,status,criado_em,configuracao_tipo,
                        data_liquidacao,valor_liquido_recebido,usuario_liquidacao_id)
                    values (?,?,?,'CREDITO',1,1,20,20,timestamp '2026-10-19 10:00','LIQUIDADO',now(),
                        'CREDITO',timestamp '2026-10-19 10:00',20,?) returning id
                    """, Long.class, empresa, pagamento, venda, usuario) : null;
            jdbc.update("""
                    insert into movimentacoes_financeiras(empresa_id,conta_financeira_id,tipo,origem,descricao,valor,
                        data_movimento,usuario_id,data_criacao,estornada,pagamento_id,recebivel_id)
                    values (?,?,'ENTRADA',?,'Recebimento sintético',?,date '2026-10-19',?,now(),false,?,?)
                    """, empresa, conta, cartao ? "RECEBIVEL_LIQUIDACAO" : "PAGAMENTO_PIX", valor, usuario,
                    cartao ? null : pagamento, recebivel);
        }
    }
    ResponseEntity<String> get(String token, String parametros) {
        var headers = new HttpHeaders(); if (token != null) headers.set(HttpHeaders.AUTHORIZATION, token);
        return http.exchange("/financeiro/movimentacoes-financeiras?" + parametros, HttpMethod.GET, new HttpEntity<>(headers), String.class);
    }
    JsonNode pagina(String token, String parametros) throws Exception {
        var resposta = get(token, parametros);
        assertThat(resposta.getStatusCode().value()).as(resposta.getBody()).isEqualTo(200);
        return json.readTree(resposta.getBody());
    }
}
