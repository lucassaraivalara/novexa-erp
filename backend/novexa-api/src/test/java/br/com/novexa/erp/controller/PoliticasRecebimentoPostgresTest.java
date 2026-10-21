package br.com.novexa.erp.controller;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.sql.DriverManager;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import static org.assertj.core.api.Assertions.*;
@EnabledIfSystemProperty(named="novexa.test.politicas.jdbc-url",matches="jdbc:postgresql://(127\\.0\\.0\\.1|localhost):.*")
class PoliticasRecebimentoPostgresTest extends PoliticasRecebimentoHttpTest {
    private static final String SCHEMA="teste_politicas_"+UUID.randomUUID().toString().replace("-","");
    private static final String URL=System.getProperty("novexa.test.politicas.jdbc-url");
    private static final String USER="postgres",PASSWORD="";
    @DynamicPropertySource static void postgres(DynamicPropertyRegistry p) {
        // A aplicacao deve completar o upgrade V30 -> V31 e executar Hibernate validate.
        Flyway.configure().dataSource(URL, USER, PASSWORD).schemas(SCHEMA).defaultSchema(SCHEMA)
                .target("48").load().migrate();
        p.add("spring.datasource.url", () -> URL + (URL.contains("?") ? "&" : "?") + "currentSchema=" + SCHEMA);
        p.add("spring.datasource.username", () -> USER); p.add("spring.datasource.password", () -> PASSWORD);
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.jpa.hibernate.ddl-auto", () -> "validate"); p.add("spring.flyway.enabled", () -> "true");
        p.add("spring.flyway.default-schema", () -> SCHEMA); p.add("spring.flyway.schemas", () -> SCHEMA);
    }

    @RepeatedTest(3) void pixConcorrente() throws Exception { concorrentes(true); }
    @RepeatedTest(3) void loteConcorrente() throws Exception { concorrentes(false); }
    @Test void flywayValidadoV49EHistoricoDefaultControlado() {
        var flyway=Flyway.configure().dataSource(URL,USER,PASSWORD).schemas(SCHEMA).defaultSchema(SCHEMA).load();
        flyway.validate();assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("49");
    }

    @RepeatedTest(3) void lotesSobrepostosPorOperadoresDiferentesNaoInvertemLocks() throws Exception {
        simplificado();var c=f.configuracao(f.empresa,4,true);venda(pedido(java.util.List.of(parte(c,20)),20));venda(pedido(java.util.List.of(parte(c,20)),20));
        var ids=recebiveis.findAll().stream().map(br.com.novexa.erp.entity.RecebivelEntity::getId).toList();
        f.segundo.setPerfil(br.com.novexa.erp.entity.PerfilUsuario.ADMIN);f.usuarios.saveAndFlush(f.segundo);String outro="Bearer "+f.jwt.gerarToken(f.segundo);
        var pool=java.util.concurrent.Executors.newFixedThreadPool(2);var inicio=new java.util.concurrent.CountDownLatch(1);
        try {
            var a=pool.submit(() -> { inicio.await();return lote(ids).andReturn().getResponse().getStatus(); });
            var b=pool.submit(() -> { inicio.await();return f.mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/financeiro/recebiveis/liquidar-lote")
                .header("Authorization",outro).contentType("application/json").content(f.json.writeValueAsBytes(java.util.Map.of("recebivelIds",ids.reversed())))).andReturn().getResponse().getStatus(); });
            inicio.countDown();assertThat(a.get(20,java.util.concurrent.TimeUnit.SECONDS)).isEqualTo(200);assertThat(b.get(20,java.util.concurrent.TimeUnit.SECONDS)).isEqualTo(200);
        } finally {inicio.countDown();pool.shutdownNow();pool.awaitTermination(5,java.util.concurrent.TimeUnit.SECONDS);}
        assertThat(saldo(c)).isEqualByComparingTo("140");assertThat(movimentosFinanceiros.count()).isEqualTo(2);
    }
    @Test void upgradeEmpresasExistentesPreservaPoliticaControladaSemBackfillFinanceiro() throws Exception {
        String historico="teste_upgrade_"+UUID.randomUUID().toString().replace("-","");
        try {
            Flyway.configure().dataSource(URL,USER,PASSWORD).schemas(historico).defaultSchema(historico).target("48").load().migrate();
            try(var c=DriverManager.getConnection(URL,USER,PASSWORD);var s=c.createStatement()){s.execute("insert into "+historico+".empresas(razao_social,ativo) values ('Legado de teste',true)");}
            var flyway=Flyway.configure().dataSource(URL,USER,PASSWORD).schemas(historico).defaultSchema(historico).load();flyway.migrate();flyway.validate();
            try(var c=DriverManager.getConnection(URL,USER,PASSWORD);var s=c.createStatement();var r=s.executeQuery("select modo_recebimento_financeiro from "+historico+".empresas")){assertThat(r.next()).isTrue();assertThat(r.getString(1)).isEqualTo("CONTROLADO");}
        } finally {try(var c=DriverManager.getConnection(URL,USER,PASSWORD);var s=c.createStatement()){s.execute("DROP SCHEMA IF EXISTS "+historico+" CASCADE");}}
    }

    @Test void inativacaoConcorrenteDoDestinoPixRejeitaFaturamentoIntegral() throws Exception {
        simplificado();var config=f.configuracao(f.empresa,2,true);var capturado=new java.util.concurrent.CountDownLatch(1);var continuar=new java.util.concurrent.CountDownLatch(1);
        org.mockito.Mockito.doAnswer(i -> {
            var p=pagamentos.saveAndFlush((br.com.novexa.erp.entity.PagamentoEntity)i.getArgument(0));capturado.countDown();
            if(!continuar.await(10,java.util.concurrent.TimeUnit.SECONDS))throw new IllegalStateException("timeout do teste");return p;
        }).when(pagamentos).save(org.mockito.ArgumentMatchers.any(br.com.novexa.erp.entity.PagamentoEntity.class));
        var pool=java.util.concurrent.Executors.newSingleThreadExecutor();
        try {
            var venda=pool.submit(() -> enviar(pedido(java.util.List.of(parte(config,20)),20)).andReturn().getResponse().getStatus());
            assertThat(capturado.await(10,java.util.concurrent.TimeUnit.SECONDS)).isTrue();
            f.jdbc.update("update contas_financeiras set ativo=false where id=?",config.getContaFinanceiraDestino().getId());continuar.countDown();
            assertThat(venda.get(20,java.util.concurrent.TimeUnit.SECONDS)).isEqualTo(409);
        } finally {continuar.countDown();pool.shutdownNow();pool.awaitTermination(5,java.util.concurrent.TimeUnit.SECONDS);}
        assertThat(f.vendas.count()).isZero();assertThat(pagamentos.count()).isZero();assertThat(movimentosFinanceiros.count()).isZero();assertThat(saldo(config)).isEqualByComparingTo("100");
    }
    @AfterAll static void limparSchema() throws Exception {
        try(var c=DriverManager.getConnection(URL,USER,PASSWORD);var s=c.createStatement()){s.execute("DROP SCHEMA IF EXISTS "+SCHEMA+" CASCADE");}
    }
}
