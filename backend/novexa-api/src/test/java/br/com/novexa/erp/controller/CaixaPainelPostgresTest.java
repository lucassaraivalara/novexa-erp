package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.service.CaixaOperacionalService;
import br.com.novexa.erp.service.JwtService;
import br.com.novexa.erp.support.AutenticacaoTeste;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import static org.assertj.core.api.Assertions.*;

/** HTTP real, Flyway e regressão do carregamento de entidades/logomarca por venda. */
@EnabledIfSystemProperty(named = "novexa.test.caixas.jdbc-url",
        matches = "jdbc:postgresql://(?:127\\.0\\.0\\.1|localhost):[0-9]+/novexa_caixas_performance_test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.jpa.open-in-view=false", "spring.jpa.show-sql=false",
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "logging.level.org.hibernate.engine.internal.StatisticalLoggingSessionEventListener=OFF",
        "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=600000",
        "supabase.url=http://127.0.0.1:9", "supabase.secret-key=synthetic-test-only", "supabase.bucket=local",
        "novexa.geocoding.url="
})
class CaixaPainelPostgresTest {
    static final String URL = System.getProperty("novexa.test.caixas.jdbc-url");
    static final String SCHEMA = "caixas_painel_" + UUID.randomUUID().toString().replace("-", "");
    static final AtomicLong CPFS = new AtomicLong(73000000000L);
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
    @Autowired EntityManagerFactory emf;
    EmpresaEntity empresa;
    String admin;
    long operador, sessao, caixa;

    @BeforeEach void preparar() {
        empresa = new EmpresaEntity(); empresa.setRazaoSocial("Performance sintética"); empresa.setAtivo(true);
        empresa.setLogomarca("x".repeat(971611)); empresa = empresas.saveAndFlush(empresa);
        admin = token(empresa, PerfilUsuario.ADMIN);
        operador = jdbc.queryForObject("select id from usuario where empresa_id=?", Long.class, empresa.getId());
        caixa = jdbc.queryForObject("insert into caixas(empresa_id,descricao,ativo) values (?,'Caixa sintético',true) returning id", Long.class, empresa.getId());
        sessao = jdbc.queryForObject("insert into sessoes_caixa(empresa_id,caixa_id,usuario_abertura_id,saldo_inicial,data_abertura,status) values (?,?,?,100,now(),'ABERTO') returning id", Long.class, empresa.getId(), caixa, operador);
        jdbc.update("insert into movimentacoes_caixa(empresa_id,sessao_id,usuario_id,chave_requisicao,tipo,valor,data_hora) values (?,?,?,?,'SUPRIMENTO',100,now())",
                empresa.getId(), sessao, operador, CaixaOperacionalService.chaveSaldoInicial(sessao));
        adicionarVendas(85);
    }

    void adicionarVendas(int quantidade) {
        jdbc.update("""
                with novas as (
                    insert into vendas(empresa_id,usuario_id,sessao_caixa_id,chave_requisicao,resumo_requisicao,
                        data_hora,data_faturamento,status,subtotal,desconto,total,forma_pagamento,valor_recebido,troco)
                    select ?,?,?,gen_random_uuid(),'sintético',now(),now(),'FATURADA',10,0,10,'DINHEIRO',10,0
                    from generate_series(1,?) returning id
                ), registros as (
                    insert into pagamentos(empresa_id,venda_id,usuario_id,sequencia,chave_requisicao,
                        forma_pagamento,forma_pagamento_id,valor,status,data_hora,valor_recebido,troco)
                    select ?,id,?,1,gen_random_uuid(),'DINHEIRO',1,10,'REGISTRADO',now(),10,0 from novas returning id
                )
                insert into movimentacoes_caixa(empresa_id,sessao_id,usuario_id,pagamento_id,chave_requisicao,tipo,valor,data_hora)
                select ?,?,?,id,gen_random_uuid(),'VENDA',10,now() from registros
                """, empresa.getId(), operador, sessao, quantidade, empresa.getId(), operador, empresa.getId(), sessao, operador);
    }

    @ParameterizedTest @EnumSource(PerfilUsuario.class)
    void perfisAutenticadosLeemSessaoAbertaSemDadosDeOutrosModulos(PerfilUsuario perfil) throws Exception {
        var painel = painel(token(empresa, perfil));
        assertThat(painel.path("resumo").path("totalVendas").decimalValue()).isEqualByComparingTo("850");
        assertThat(painel.path("resumo").path("saldoEsperadoDinheiro").decimalValue()).isEqualByComparingTo("950");
        assertThat(painel.path("vendas").size()).isEqualTo(85);
        assertThat(painel.path("movimentacoes").size()).isEqualTo(86);
        assertThat(painel.path("vendas").get(0).size()).isEqualTo(5);
        assertThat(painel.toString()).doesNotContain("logomarca", "senha", "itens", "cpf");
    }

    @Test void quantidadeDeQueriesNaoCresceComVendasOuLogomarca() throws Exception {
        painel(admin); // Aquece inicialização HTTP e estatísticas fora da medição.
        var stats = emf.unwrap(SessionFactory.class).getStatistics(); stats.clear();
        painel(admin);
        long primeira = stats.getPrepareStatementCount();
        assertThat(primeira).isLessThanOrEqualTo(16);
        assertThat(stats.getEntityLoadCount()).isLessThanOrEqualTo(8);
        adicionarVendas(100); stats.clear();
        var resultado = painel(admin);
        assertThat(stats.getPrepareStatementCount()).isEqualTo(primeira);
        assertThat(stats.getEntityLoadCount()).isLessThanOrEqualTo(8);
        assertThat(resultado.path("vendas").size()).isEqualTo(185);
        assertThat(resultado.path("resumo").path("totalVendas").decimalValue()).isEqualByComparingTo("1850");
    }

    @Test void outroTenantNaoConsultaSessaoNemMovimentos() {
        var outra = new EmpresaEntity(); outra.setRazaoSocial("Outro tenant"); outra.setAtivo(true);
        outra = empresas.saveAndFlush(outra);
        var resposta = get(token(outra, PerfilUsuario.ADMIN), "/painel");
        assertThat(resposta.getStatusCode().value()).isEqualTo(404);
    }

    @Test void semAutenticacaoRecebe401() {
        assertThat(get(null, "/painel").getStatusCode().value()).isEqualTo(401);
    }

    @ParameterizedTest @EnumSource(PerfilUsuario.class)
    void sessaoFechadaMantemRegraDeGerenteOuResponsavel(PerfilUsuario perfil) {
        fecharFixture();
        var resposta = get(token(empresa, perfil), "/painel");
        assertThat(resposta.getStatusCode().value()).isEqualTo(perfil == PerfilUsuario.ADMIN || perfil == PerfilUsuario.GERENTE ? 200 : 403);
    }

    @Test void responsavelOperacionalPodeConsultarSeuFechamento() throws Exception {
        String responsavel = token(empresa, PerfilUsuario.OPERADOR);
        long id = jdbc.queryForObject("select id from usuario where empresa_id=? and perfil='OPERADOR'", Long.class, empresa.getId());
        fecharFixture(); jdbc.update("update sessoes_caixa set usuario_abertura_id=? where id=?", id, sessao);
        assertThat(painel(responsavel).path("resumo").path("status").asText()).isEqualTo("FECHADO");
    }

    @Test void estornoSuprimentoESangriaPreservamTotaisESaldoInicialUnico() throws Exception {
        var pagamento = jdbc.queryForMap("select id,venda_id from pagamentos where empresa_id=? order by id limit 1", empresa.getId());
        jdbc.update("update pagamentos set status='CANCELADO' where id=?", pagamento.get("id"));
        jdbc.update("update vendas set status='CANCELADA' where id=?", pagamento.get("venda_id"));
        jdbc.update("insert into movimentacoes_caixa(empresa_id,sessao_id,usuario_id,pagamento_id,chave_requisicao,tipo,valor,data_hora) values (?,?,?,?,?,'ESTORNO_VENDA',10,now())",
                empresa.getId(), sessao, operador, pagamento.get("id"), UUID.randomUUID());
        for (var movimento : Map.of("SUPRIMENTO",20,"SANGRIA",5).entrySet())
            jdbc.update("insert into movimentacoes_caixa(empresa_id,sessao_id,usuario_id,chave_requisicao,tipo,valor,data_hora) values (?,?,?,?,?,?,now())",
                    empresa.getId(), sessao, operador, UUID.randomUUID(), movimento.getKey(), movimento.getValue());
        var painel = painel(admin); var resumo = painel.path("resumo");
        assertThat(resumo.path("totalVendas").decimalValue()).isEqualByComparingTo("840");
        assertThat(resumo.path("suprimentos").decimalValue()).isEqualByComparingTo("20");
        assertThat(resumo.path("sangrias").decimalValue()).isEqualByComparingTo("5");
        assertThat(resumo.path("saldoEsperadoDinheiro").decimalValue()).isEqualByComparingTo("955");
        assertThat(painel.path("vendas").size()).isEqualTo(84);
        assertThat(json.readTree(get(admin,"/resumo").getBody())).isEqualTo(resumo);
        assertThat(json.readTree(get(admin,"/movimentacoes").getBody())).isEqualTo(painel.path("movimentacoes"));
    }

    void fecharFixture() {
        jdbc.update("update sessoes_caixa set status='FECHADO',saldo_final=950,data_fechamento=now(),usuario_fechamento_id=?,modalidade_conferencia='LEGADA' where id=?", operador, sessao);
    }
    String token(EmpresaEntity e, PerfilUsuario perfil) { return AutenticacaoTeste.token(usuarios,jwt,e,perfil,Long.toString(CPFS.incrementAndGet())); }
    ResponseEntity<String> get(String token, String sufixo) {
        var headers = new HttpHeaders(); if (token != null) headers.set(HttpHeaders.AUTHORIZATION,token);
        return http.exchange("/financeiro/caixas/sessoes/"+sessao+sufixo,HttpMethod.GET,new HttpEntity<>(headers),String.class);
    }
    JsonNode painel(String token) throws Exception {
        var resposta = get(token,"/painel"); assertThat(resposta.getStatusCode().value()).as(resposta.getBody()).isEqualTo(200);
        return json.readTree(resposta.getBody());
    }
}
