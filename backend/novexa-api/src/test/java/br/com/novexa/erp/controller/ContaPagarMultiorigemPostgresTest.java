package br.com.novexa.erp.controller;

import org.junit.jupiter.api.*;
import org.springframework.http.*;
import org.springframework.test.context.TestPropertySource;
import org.hibernate.resource.jdbc.spi.StatementInspector;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

/** Mesma proteção loopback/fixture descartável e regressões V61 herdadas. */
@TestPropertySource(properties="spring.jpa.properties.hibernate.session_factory.statement_inspector=br.com.novexa.erp.controller.ContaPagarMultiorigemPostgresTest$Sql")
@org.springframework.context.annotation.Import(ContaPagarMultiorigemPostgresTest.FalhaRespostaConfig.class)
class ContaPagarMultiorigemPostgresTest extends ContaPagarEncargosPostgresTest {
    @org.springframework.boot.test.context.TestConfiguration
    static class FalhaRespostaConfig {
        @org.springframework.context.annotation.Bean
        org.springframework.boot.web.servlet.FilterRegistrationBean<jakarta.servlet.Filter> perdaDaResposta() {
            var registro=new org.springframework.boot.web.servlet.FilterRegistrationBean<jakarta.servlet.Filter>();
            registro.setFilter((request,response,chain)->{
                var req=(jakarta.servlet.http.HttpServletRequest)request;
                if(!"yes".equals(req.getHeader("X-Test-Drop-Reply"))) {chain.doFilter(request,response);return;}
                var res=(jakarta.servlet.http.HttpServletResponse)response;
                var buffer=new org.springframework.web.util.ContentCachingResponseWrapper(res);
                chain.doFilter(request,buffer); // O controller já concluiu o TransactionTemplate/COMMIT.
                if(buffer.getStatus()!=200) {buffer.copyBodyToResponse();return;}
                res.resetBuffer();res.setStatus(503);res.setContentLength(-1);res.setContentType("text/plain;charset=UTF-8");
                res.getOutputStream().write("Resposta sintética indisponível após a conclusão do comando.".getBytes(java.nio.charset.StandardCharsets.UTF_8));
            });
            registro.addUrlPatterns("/financeiro/contas-pagar/*");return registro;
        }
    }
    public static class Sql implements StatementInspector {
        static final List<String> statements=new CopyOnWriteArrayList<>();
        public String inspect(String sql){statements.add(sql);return sql;}
    }
    long segunda,terceira;
    @BeforeEach void origens() {
        segunda=conta("Banco sintético","1000"); terceira=conta("Terceira","1000");
    }
    long conta(String nome,String saldo) {
        return jdbc.queryForObject("insert into contas_financeiras(empresa_id,nome,tipo,saldo_inicial,saldo_atual,ativo,data_criacao,data_atualizacao) values (?,?,'CAIXA',?,?,true,now(),now()) returning id",Long.class,empresa,nome,new BigDecimal(saldo),new BigDecimal(saldo));
    }
    String novo(){return "/financeiro/contas-pagar/"+titulo+"/pagamentos";}
    Map<String,Object> origem(long id,String valor){return Map.of("contaFinanceiraId",id,"valor",valor);}
    Map<String,Object> mult(String total,Map<String,Object>... origens) {
        return new HashMap<>(Map.of("chaveRequisicao",UUID.randomUUID().toString(),"dataPagamento",br.com.novexa.erp.time.TempoNovexa.hoje().toString(),
            "valorPago",total,"juros","0.00","multa","0.00","desconto","0.00","origens",List.of(origens)));
    }
    BigDecimal saldo(long id){return jdbc.queryForObject("select saldo_atual from contas_financeiras where id=?",BigDecimal.class,id);}
    String refund(long id){return novo()+"/"+id+"/estornar";}
    void semEfeitos() {
        assertThat(saldo()).isEqualByComparingTo("1000");assertThat(saldo(segunda)).isEqualByComparingTo("1000");
        assertThat(jdbc.queryForObject("select status from contas_pagar where id=?",String.class,titulo)).isEqualTo("ABERTA");
        assertThat(jdbc.queryForObject("select count(*) from pagamentos_conta_pagar where conta_pagar_id=?",Long.class,titulo)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from movimentacoes_financeiras where empresa_id=?",Long.class,empresa)).isZero();
    }
    @Test void aceiteDuasOrigensQuitacaoUnicaEEstornoCompleto() throws Exception {
        jdbc.update("update contas_pagar set valor=1245.87 where id=?",titulo);
        var p=mult("1245.87",origem(financeira,"300.00"),origem(segunda,"945.87"));
        var pago=corpo(call(HttpMethod.POST,novo(),p,token,200));long id=pago.path("id").asLong();
        assertThat(pago.path("principalQuitado").decimalValue()).isEqualByComparingTo("1245.87");
        assertThat(pago.path("origens").size()).isEqualTo(2);assertThat(saldo()).isEqualByComparingTo("700");assertThat(saldo(segunda)).isEqualByComparingTo("54.13");
        var tituloPago=corpo(call(HttpMethod.GET,"/financeiro/contas-pagar/"+titulo,null,token,200));
        assertThat(tituloPago.path("status").asText()).isEqualTo("PAGA");assertThat(tituloPago.path("pagamentoAtualId").asLong()).isEqualTo(id);
        assertThat(jdbc.queryForObject("select count(*) from movimentacoes_financeiras where pagamento_conta_pagar_id=? and tipo='SAIDA'",Long.class,id)).isEqualTo(2);
        call(HttpMethod.POST,refund(id),Map.of("motivoEstorno","Conferência sintética"),operador,403);
        call(HttpMethod.POST,refund(id),Map.of("motivoEstorno","Conferência sintética"),token,200);
        call(HttpMethod.POST,refund(id),Map.of("motivoEstorno","Conferência sintética"),token,200);
        assertThat(saldo()).isEqualByComparingTo("1000");assertThat(saldo(segunda)).isEqualByComparingTo("1000");
        assertThat(corpo(call(HttpMethod.POST,novo(),p,token,200)).path("estado").asText()).isEqualTo("ESTORNADO");
        assertThat(saldo()).isEqualByComparingTo("1000");
        call(HttpMethod.POST,novo(),mult("1245.87",origem(financeira,"300"),origem(segunda,"945.87")),token,200);
        assertThat(corpo(call(HttpMethod.GET,novo(),null,token,200)).path("totalItems").asInt()).isEqualTo(2);
    }
    @Test void umaETresOrigensComCentavosEEncargosGlobais() throws Exception {
        var p=mult("665.00",origem(financeira,"200.01"),origem(segunda,"300.02"),origem(terceira,"164.97"));
        p.put("juros","15.88");p.put("multa","7.25");p.put("desconto","3.13");
        var pago=corpo(call(HttpMethod.POST,novo(),p,operador,200));
        assertThat(pago.path("origens").size()).isEqualTo(3);assertThat(pago.path("principalQuitado").decimalValue()).isEqualByComparingTo("645");
        assertThat(pago.path("juros").decimalValue()).isEqualByComparingTo("15.88");
        assertThat(jdbc.queryForObject("select sum(valor) from movimentacoes_financeiras where pagamento_conta_pagar_id=?",BigDecimal.class,pago.path("id").asLong())).isEqualByComparingTo("665");
        assertThat(jdbc.queryForObject("select count(*) from movimentacoes_financeiras where empresa_id=? and conta_pagar_juros is not null",Long.class,empresa)).isZero();
        // Adaptador legado estorna o conjunto, sem escolher uma das três origens.
        call(HttpMethod.POST,estornar(),Map.of(),token,200);
        assertThat(saldo(terceira)).isEqualByComparingTo("1000");
        var um=mult("634.50",origem(segunda,"634.50"));um.put("desconto","10.50");call(HttpMethod.POST,novo(),um,token,200);
        var resumo=corpo(call(HttpMethod.GET,"/financeiro/contas-pagar/resumo",null,token,200));
        assertThat(resumo.path("pagasMes").path("total").decimalValue()).isEqualByComparingTo("634.50");
        assertThat(resumo.path("pagasMes").path("quantidade").asInt()).isEqualTo(1);
    }
    @Test void rejeitaSomasDuplicatasNegativosZerosEParcialSemGravar() {
        for(var p:List.of(mult("645",origem(financeira,"300"),origem(segunda,"344.99")),
                mult("645",origem(financeira,"300"),origem(financeira,"345")),mult("645",origem(financeira,"0"),origem(segunda,"645")),
                mult("645",origem(financeira,"-1"),origem(segunda,"646")),mult("500",origem(financeira,"500"))))
            call(HttpMethod.POST,novo(),p,token,400);
        var p=mult("645",origem(financeira,"645"));p.put("juros","0.001");call(HttpMethod.POST,novo(),p,token,400);
        p.put("juros","0");p.put("desconto","700");call(HttpMethod.POST,novo(),p,token,400);semEfeitos();
    }
    @Test void saldoInatividadeTenantEAutenticacao() {
        var p=mult("645",origem(financeira,"300"),origem(segunda,"345"));
        jdbc.update("update contas_financeiras set saldo_atual=100 where id=?",segunda);call(HttpMethod.POST,novo(),p,token,409);
        assertThat(saldo()).isEqualByComparingTo("1000");jdbc.update("update contas_financeiras set saldo_atual=1000,ativo=false where id=?",segunda);
        call(HttpMethod.POST,novo(),p,token,409);jdbc.update("update contas_financeiras set ativo=true,tipo='ADQUIRENTE' where id=?",segunda);
        call(HttpMethod.POST,novo(),p,token,409);jdbc.update("update contas_financeiras set tipo='CAIXA' where id=?",segunda);
        call(HttpMethod.POST,novo(),p,externo,404);call(HttpMethod.POST,novo(),p,null,401);
        var estrangeira=jdbc.queryForObject("select min(id) from empresas where id<>?",Long.class,empresa);
        jdbc.update("update contas_financeiras set empresa_id=? where id=?",estrangeira,segunda);
        call(HttpMethod.POST,novo(),p,token,404);jdbc.update("update contas_financeiras set empresa_id=? where id=?",empresa,segunda);semEfeitos();
    }
    @Test void retryCanonicoChaveIncompativelETituloPago() throws Exception {
        var p=mult("645.00",origem(financeira,"300"),origem(segunda,"345"));var primeiro=corpo(call(HttpMethod.POST,novo(),p,token,200));
        p.put("origens",List.of(origem(segunda,"345.00"),origem(financeira,"300.00")));p.put("valorPago","645");
        assertThat(corpo(call(HttpMethod.POST,novo(),p,token,200)).path("id")).isEqualTo(primeiro.path("id"));
        p.put("dataPagamento","2026-01-01");call(HttpMethod.POST,novo(),p,token,409);
        call(HttpMethod.POST,novo(),mult("645",origem(financeira,"300"),origem(segunda,"345")),token,409);
        assertThat(saldo()).isEqualByComparingTo("700");
    }
    @Test void confirmaSimultaneamenteUmaUnicaBaixa() throws Exception {
        var p=mult("645",origem(financeira,"300"),origem(segunda,"345"));var inicio=new CountDownLatch(1);
        var pool=Executors.newFixedThreadPool(2);
        try {
            Callable<Long> job=()->{inicio.await();return corpo(call(HttpMethod.POST,novo(),p,token,200)).path("id").asLong();};
            var a=pool.submit(job);var b=pool.submit(job);inicio.countDown();assertThat(a.get(20,TimeUnit.SECONDS)).isEqualTo(b.get(20,TimeUnit.SECONDS));
            assertThat(saldo()).isEqualByComparingTo("700");assertThat(saldo(segunda)).isEqualByComparingTo("655");
        } finally {pool.shutdownNow();}
    }
    @Test void falhaRealNoSegundoDebitoDesfazTudo() {
        jdbc.execute("create function falha_multi_"+titulo+"() returns trigger language plpgsql as $$ begin if NEW.conta_financeira_id="+segunda+" and NEW.pagamento_conta_pagar_id IS NOT NULL then raise exception 'falha sintética segunda origem'; end if; return NEW; end $$");
        jdbc.execute("create trigger falha_multi_"+titulo+" before insert on movimentacoes_financeiras for each row execute function falha_multi_"+titulo+"()");
        try{call(HttpMethod.POST,novo(),mult("645",origem(financeira,"300"),origem(segunda,"345")),token,500);semEfeitos();}
        finally{jdbc.execute("drop trigger falha_multi_"+titulo+" on movimentacoes_financeiras");jdbc.execute("drop function falha_multi_"+titulo+"()");}
    }
    @Test void falhaRealNoSegundoEstornoPreservaBaixaEDebitos() throws Exception {
        var pago=corpo(call(HttpMethod.POST,novo(),mult("645",origem(financeira,"300"),origem(segunda,"345")),token,200));long id=pago.path("id").asLong();
        jdbc.execute("create function falha_multi_est_"+titulo+"() returns trigger language plpgsql as $$ begin if NEW.conta_financeira_id="+segunda+" and NEW.estornada then raise exception 'falha sintética estorno'; end if; return NEW; end $$");
        jdbc.execute("create trigger falha_multi_est_"+titulo+" before update on movimentacoes_financeiras for each row execute function falha_multi_est_"+titulo+"()");
        try {
            call(HttpMethod.POST,refund(id),Map.of("motivoEstorno","Teste"),token,500);
            assertThat(saldo()).isEqualByComparingTo("700");assertThat(saldo(segunda)).isEqualByComparingTo("655");
            assertThat(jdbc.queryForObject("select estado from pagamentos_conta_pagar where id=?",String.class,id)).isEqualTo("CONFIRMADO");
            assertThat(jdbc.queryForObject("select count(*) from movimentacoes_financeiras where pagamento_conta_pagar_id=? and estornada",Long.class,id)).isZero();
        } finally {jdbc.execute("drop trigger falha_multi_est_"+titulo+" on movimentacoes_financeiras");jdbc.execute("drop function falha_multi_est_"+titulo+"()");}
        jdbc.update("update contas_financeiras set ativo=false where id=?",segunda);
        call(HttpMethod.POST,refund(id),Map.of("motivoEstorno","Teste"),token,200);assertThat(saldo(segunda)).isEqualByComparingTo("1000");
    }
    @Test void historicoPaginadoNaoCarregaUmaConsultaPorPagamento() throws Exception {
        for(int i=0;i<6;i++) {
            var pago=corpo(call(HttpMethod.POST,novo(),mult("645",origem(financeira,"300"),origem(segunda,"345")),token,200));
            call(HttpMethod.POST,refund(pago.path("id").asLong()),Map.of("motivoEstorno","Histórico sintético"),token,200);
        }
        Sql.statements.clear();call(HttpMethod.GET,novo()+"?size=1",null,token,200);int uma=Sql.statements.size();
        Sql.statements.clear();var pagina=call(HttpMethod.GET,novo()+"?size=10",null,token,200);int seis=Sql.statements.size();
        assertThat(corpo(pagina).path("items").size()).isEqualTo(6);assertThat(seis).isLessThanOrEqualTo(uma+1);
        assertThat(String.join(" ",Sql.statements).toLowerCase()).doesNotContain("logomarca");
        assertThat(pagina.getBody()).doesNotContain("base64","logomarca");
        var out=java.nio.file.Path.of("target/sprint23b");java.nio.file.Files.createDirectories(out);
        java.nio.file.Files.writeString(out.resolve("history-sql.json"),"{\"onePaymentPageSql\":"+uma+",\"sixPaymentsPageSql\":"+seis+",\"bytes\":"+pagina.getBody().getBytes(java.nio.charset.StandardCharsets.UTF_8).length+"}");
    }
    @Test void migracaoV61V62AditivaPreservaRegistrosESaldos() throws Exception {
        call(HttpMethod.POST,pagar(),pedido("15.88","0","0","660.88"),token,200);
        String legado="multi_legacy_"+UUID.randomUUID().toString().replace("-","");
        var config=org.flywaydb.core.Flyway.configure().dataSource(URL+"?currentSchema="+legado,"postgres","")
            .schemas(legado).defaultSchema(legado).cleanDisabled(true);
        config.target("61").load().migrate();
        var colunasPorTabela=new LinkedHashMap<String,String>();var antes=new LinkedHashMap<String,String>();
        for(String tabela:List.of("empresas","usuario","contas_financeiras","movimentacoes_financeiras","contas_pagar")) {
            String colunas=jdbc.queryForObject("select string_agg(quote_ident(column_name),',' order by ordinal_position) from information_schema.columns where table_schema=? and table_name=?",String.class,legado,tabela);
            colunasPorTabela.put(tabela,colunas);
            jdbc.execute("insert into "+legado+"."+tabela+"("+colunas+") select "+colunas+" from "+SCHEMA+"."+tabela);
            antes.put(tabela,jdbc.queryForObject("select md5(coalesce(string_agg(row_to_json(t)::text,',' order by id),'')) from (select "+colunas+" from "+legado+"."+tabela+") t",String.class));
        }
        var flyway=org.flywaydb.core.Flyway.configure().dataSource(URL+"?currentSchema="+legado,"postgres","")
            .schemas(legado).defaultSchema(legado).cleanDisabled(true).load();
        assertThat(flyway.migrate().migrationsExecuted).isEqualTo(1);flyway.validate();
        assertThat(flyway.info().current().getVersion().toString()).isEqualTo("62");
        for(var item:antes.entrySet())assertThat(jdbc.queryForObject("select md5(coalesce(string_agg(row_to_json(t)::text,',' order by id),'')) from (select "+colunasPorTabela.get(item.getKey())+" from "+legado+"."+item.getKey()+") t",String.class)).isEqualTo(item.getValue());
        assertThat(jdbc.queryForObject("select count(*) from "+legado+".pagamentos_conta_pagar",Long.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from "+legado+".contas_pagar where pagamento_atual_id is not null",Long.class)).isZero();
    }
    @Test void titulosConcorrentesBloqueiamContasNaMesmaOrdem() throws Exception {
        long outro=criarTitulo();var inicio=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var a=pool.submit(()->{inicio.await();return call(HttpMethod.POST,novo(),mult("645",origem(financeira,"300"),origem(segunda,"345")),token,200);});
            var b=pool.submit(()->{inicio.await();return call(HttpMethod.POST,"/financeiro/contas-pagar/"+outro+"/pagamentos",mult("645",origem(segunda,"345"),origem(financeira,"300")),token,200);});
            inicio.countDown();a.get(20,TimeUnit.SECONDS);b.get(20,TimeUnit.SECONDS);
        }
        assertThat(saldo()).isEqualByComparingTo("400");assertThat(saldo(segunda)).isEqualByComparingTo("310");
    }
    @Test void novaChaveConcorrenteNaoDuplicaEEstornoGenericoRecusado() throws Exception {
        var inicio=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            Callable<Integer> tarefa=()->{inicio.await();var h=new HttpHeaders();h.set("Authorization",token);
                return http.postForEntity(novo(),new HttpEntity<>(mult("645",origem(financeira,"300"),origem(segunda,"345")),h),String.class).getStatusCode().value();};
            var a=pool.submit(tarefa);var b=pool.submit(tarefa);inicio.countDown();
            assertThat(List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
        }
        long movimento=jdbc.queryForObject("select min(id) from movimentacoes_financeiras where empresa_id=?",Long.class,empresa);
        call(HttpMethod.PATCH,"/financeiro/movimentacoes-financeiras/"+movimento+"/estorno",Map.of("motivoEstorno","Teste"),token,409);
        assertThat(saldo()).isEqualByComparingTo("700");
        call(HttpMethod.GET,novo(),null,externo,404);call(HttpMethod.GET,novo()+"?size=101",null,token,400);
    }

    @Test void concorrenciaComSaldoCompartilhadoInsuficienteNaoProduzSaldoNegativo() throws Exception {
        long outro=criarTitulo();var inicio=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            Callable<Integer> a=()->{inicio.await();var h=new HttpHeaders();h.set("Authorization",token);
                return http.postForEntity(novo(),new HttpEntity<>(mult("645",origem(financeira,"600"),origem(segunda,"45")),h),String.class).getStatusCode().value();};
            Callable<Integer> b=()->{inicio.await();var h=new HttpHeaders();h.set("Authorization",token);
                return http.postForEntity("/financeiro/contas-pagar/"+outro+"/pagamentos",new HttpEntity<>(mult("645",origem(segunda,"45"),origem(financeira,"600")),h),String.class).getStatusCode().value();};
            var fa=pool.submit(a);var fb=pool.submit(b);inicio.countDown();assertThat(List.of(fa.get(20,TimeUnit.SECONDS),fb.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
        }
        assertThat(saldo()).isEqualByComparingTo("400");assertThat(saldo(segunda)).isEqualByComparingTo("955");
        assertThat(jdbc.queryForObject("select count(*) from pagamentos_conta_pagar where empresa_id=?",Long.class,empresa)).isEqualTo(1);
    }
    @Test void mesmaChaveEmTitulosDiferentesNaoReaplicaDebitos() throws Exception {
        long outro=criarTitulo();var p=mult("645",origem(financeira,"300"),origem(segunda,"345"));var inicio=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            Callable<Integer> a=()->{inicio.await();var h=new HttpHeaders();h.set("Authorization",token);return http.postForEntity(novo(),new HttpEntity<>(p,h),String.class).getStatusCode().value();};
            Callable<Integer> b=()->{inicio.await();var h=new HttpHeaders();h.set("Authorization",token);return http.postForEntity("/financeiro/contas-pagar/"+outro+"/pagamentos",new HttpEntity<>(p,h),String.class).getStatusCode().value();};
            var fa=pool.submit(a);var fb=pool.submit(b);inicio.countDown();assertThat(List.of(fa.get(20,TimeUnit.SECONDS),fb.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
        }
        assertThat(saldo()).isEqualByComparingTo("700");assertThat(saldo(segunda)).isEqualByComparingTo("655");
    }
    @Test void medirCustoLegadoEGrupoUmaDuasTresOrigens() throws Exception {
        var medidas=new LinkedHashMap<String,Object>();
        Sql.statements.clear();var legado=call(HttpMethod.POST,pagar(),pedido("0","0","0","645"),token,200);
        medidas.put("legadoUmaOrigem",medicao(legado));call(HttpMethod.POST,estornar(),Map.of(),token,200);
        for(int n=1;n<=3;n++) {
            List<Map<String,Object>> origens=n==1?List.of(origem(financeira,"645")):n==2?List.of(origem(financeira,"300"),origem(segunda,"345")):
                List.of(origem(financeira,"200.01"),origem(segunda,"300.02"),origem(terceira,"144.97"));
            var p=mult("645");p.put("origens",origens);Sql.statements.clear();var resposta=call(HttpMethod.POST,novo(),p,token,200);
            medidas.put("grupo"+n+"Origens",medicao(resposta));
            call(HttpMethod.POST,refund(corpo(resposta).path("id").asLong()),Map.of("motivoEstorno","Medição sintética"),token,200);
        }
        var out=java.nio.file.Path.of("target/sprint23b");java.nio.file.Files.createDirectories(out);json.writerWithDefaultPrettyPrinter().writeValue(out.resolve("payment-sql.json").toFile(),medidas);
    }
    Map<String,Object> medicao(ResponseEntity<String> r) {
        var s=List.copyOf(Sql.statements);
        return Map.of("statements",s.size(),"select",s.stream().filter(q->q.toLowerCase().startsWith("select")).count(),
            "insert",s.stream().filter(q->q.toLowerCase().startsWith("insert")).count(),"update",s.stream().filter(q->q.toLowerCase().startsWith("update")).count(),
            "responseUtf8Bytes",r.getBody().getBytes(java.nio.charset.StandardCharsets.UTF_8).length);
    }

    @Test
    @org.junit.jupiter.api.condition.EnabledIfSystemProperty(named="novexa.test.multiorigem.browser",matches="true")
    void navegadorHttpRealPostgresDescartavel() throws Exception {
        jdbc.update("update contas_pagar set valor=1245.87 where id=?",titulo);
        var frontend=java.nio.file.Path.of("../../frontend").toAbsolutePath().normalize();
        var out=java.nio.file.Path.of("target/sprint23b/browser.log").toAbsolutePath();
        var builder=new ProcessBuilder("node.exe","tests/contas-pagar-multiorigem-http-smoke.mjs").directory(frontend.toFile())
            .redirectErrorStream(true).redirectOutput(out.toFile());
        builder.environment().putAll(Map.of("NOVEXA_MULTI_DISPOSABLE","true","NOVEXA_MULTI_URL",http.getRootUri(),
            "NOVEXA_MULTI_TOKEN",token.replaceFirst("^Bearer ",""),"NOVEXA_MULTI_TITULO",Long.toString(titulo),"NOVEXA_MULTI_EMPRESA",Long.toString(empresa)));
        var processo=builder.start();
        try{assertThat(processo.waitFor(90,TimeUnit.SECONDS)).isTrue();assertThat(processo.exitValue()).as(java.nio.file.Files.readString(out)).isZero();}
        finally{if(processo.isAlive())processo.destroyForcibly();}
        assertThat(saldo()).isEqualByComparingTo("1000");assertThat(saldo(segunda)).isEqualByComparingTo("1000");
        assertThat(jdbc.queryForObject("select status from contas_pagar where id=?",String.class,titulo)).isEqualTo("ABERTA");
        assertThat(jdbc.queryForObject("select count(*) from pagamentos_conta_pagar where conta_pagar_id=? and estado='ESTORNADO'",Long.class,titulo)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from movimentacoes_financeiras where empresa_id=? and estornada",Long.class,empresa)).isEqualTo(2);
    }

    @Test void falhaPostgresDuranteCommitDeferredReverteTudoERetrySeguro() throws Exception {
        String objeto="commit_multi_"+titulo;
        jdbc.execute("create sequence "+objeto);
        jdbc.execute("create function "+objeto+"() returns trigger language plpgsql as $$ begin if NEW.conta_pagar_id="+titulo+" then "
            +"if (select count(*) from movimentacoes_financeiras where pagamento_conta_pagar_id=NEW.id)=2 and (select status from contas_pagar where id=NEW.conta_pagar_id)='PAGA' then perform nextval('"+objeto+"'); end if; "
            +"raise exception 'falha diferida no commit'; end if; return NEW; end $$");
        jdbc.execute("create constraint trigger "+objeto+" after insert on pagamentos_conta_pagar deferrable initially deferred for each row execute function "+objeto+"()");
        var p=mult("645",origem(financeira,"300"),origem(segunda,"345"));
        try {
            call(HttpMethod.POST,novo(),p,token,500);
            // nextval não é revertido: comprova que a constraint diferida viu ambos os efeitos e o título PAGA.
            assertThat(jdbc.queryForObject("select is_called from "+objeto,Boolean.class)).isTrue();semEfeitos();
        } finally {
            jdbc.execute("drop trigger "+objeto+" on pagamentos_conta_pagar");jdbc.execute("drop function "+objeto+"()");jdbc.execute("drop sequence "+objeto);
        }
        var pago=corpo(call(HttpMethod.POST,novo(),p,token,200));
        assertThat(corpo(call(HttpMethod.POST,novo(),p,token,200)).path("id")).isEqualTo(pago.path("id"));
        assertThat(saldo()).isEqualByComparingTo("700");assertThat(saldo(segunda)).isEqualByComparingTo("655");
    }
    @Test void resposta503AposCommitConfirmadoConsultaERetryNaoDuplicam() throws Exception {
        var p=mult("645",origem(financeira,"300"),origem(segunda,"345"));var h=new HttpHeaders();h.set("Authorization",token);h.set("X-Test-Drop-Reply","yes");
        var perdida=http.postForEntity(novo(),new HttpEntity<>(p,h),String.class);assertThat(perdida.getStatusCode().value()).isEqualTo(503);
        assertThat(saldo()).isEqualByComparingTo("700");assertThat(saldo(segunda)).isEqualByComparingTo("655");
        String consulta=novo()+"/por-chave/"+p.get("chaveRequisicao");
        var confirmado=corpo(call(HttpMethod.GET,consulta,null,token,200));
        assertThat(confirmado.path("estado").asText()).isEqualTo("CONFIRMADO");
        assertThat(corpo(call(HttpMethod.POST,novo(),p,token,200)).path("id")).isEqualTo(confirmado.path("id"));
        call(HttpMethod.GET,consulta,null,externo,404);
        call(HttpMethod.GET,"/financeiro/contas-pagar/"+criarTitulo()+"/pagamentos/por-chave/"+p.get("chaveRequisicao"),null,token,404);
        assertThat(jdbc.queryForObject("select count(*) from movimentacoes_financeiras where empresa_id=?",Long.class,empresa)).isEqualTo(2);
    }
    @Test void doisEstornosSimultaneosRevertemTresOrigensComEncargosUmaVez() throws Exception {
        var p=mult("665",origem(financeira,"200.01"),origem(segunda,"300.02"),origem(terceira,"164.97"));
        p.put("juros","15.88");p.put("multa","7.25");p.put("desconto","3.13");
        long id=corpo(call(HttpMethod.POST,novo(),p,token,200)).path("id").asLong();var inicio=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            Callable<String> tarefa=()->{inicio.await();return corpo(call(HttpMethod.POST,refund(id),Map.of("motivoEstorno","Estorno simultâneo sintético"),token,200)).path("dataEstorno").asText();};
            var a=pool.submit(tarefa);var b=pool.submit(tarefa);inicio.countDown();assertThat(a.get(20,TimeUnit.SECONDS)).isEqualTo(b.get(20,TimeUnit.SECONDS));
        }
        for(long origem:new long[]{financeira,segunda,terceira})assertThat(saldo(origem)).isEqualByComparingTo("1000");
        assertThat(jdbc.queryForObject("select status from contas_pagar where id=?",String.class,titulo)).isEqualTo("ABERTA");
        assertThat(jdbc.queryForObject("select count(*) from movimentacoes_financeiras where pagamento_conta_pagar_id=? and estornada",Long.class,id)).isEqualTo(3);
        assertThat(jdbc.queryForObject("select count(*) from pagamentos_conta_pagar where conta_pagar_id=? and estado='ESTORNADO'",Long.class,titulo)).isEqualTo(1);
    }
    @Test void correcaoConcorrenteMantemChaveEImpedeDuasBaixas() throws Exception {
        var a=mult("645",origem(financeira,"300"),origem(segunda,"345"));var b=new HashMap<>(a);b.put("origens",List.of(origem(financeira,"200"),origem(segunda,"445")));
        var inicio=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var fa=pool.submit(()->{inicio.await();return enviarSemExigirStatus(a);});var fb=pool.submit(()->{inicio.await();return enviarSemExigirStatus(b);});inicio.countDown();
            assertThat(List.of(fa.get(20,TimeUnit.SECONDS),fb.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
        }
        var confirmado=corpo(call(HttpMethod.GET,novo()+"/por-chave/"+a.get("chaveRequisicao"),null,token,200));
        for(var o:confirmado.path("origens"))assertThat(saldo(o.path("contaFinanceiraId").asLong())).isEqualByComparingTo(new BigDecimal("1000").subtract(o.path("valor").decimalValue()));
        assertThat(jdbc.queryForObject("select count(*) from pagamentos_conta_pagar where conta_pagar_id=?",Long.class,titulo)).isEqualTo(1);
    }
    int enviarSemExigirStatus(Map<String,Object> p) {var h=new HttpHeaders();h.set("Authorization",token);return http.postForEntity(novo(),new HttpEntity<>(p,h),String.class).getStatusCode().value();}

}
