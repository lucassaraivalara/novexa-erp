package br.com.novexa.erp.controller;

import org.junit.jupiter.api.*;
import org.springframework.http.*;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.test.context.TestPropertySource;
import static org.assertj.core.api.Assertions.*;

/** HTTP real, Flyway/Hibernate validate e banco exclusivamente loopback descartável. */
@TestPropertySource(properties="spring.jpa.properties.hibernate.session_factory.statement_inspector=br.com.novexa.erp.controller.ContaPagarMultiorigemPostgresTest$Sql")
class ContaPagarParcialPostgresTest extends ContaPagarEncargosPostgresTest {
    long segunda;
    @BeforeEach void segundaOrigem() {
        segunda=jdbc.queryForObject("insert into contas_financeiras(empresa_id,nome,tipo,saldo_inicial,saldo_atual,ativo,data_criacao,data_atualizacao) values (?,'Banco sintético','BANCO',1000,1000,true,now(),now()) returning id",Long.class,empresa);
    }
    String baixas(){return "/financeiro/contas-pagar/"+titulo+"/pagamentos";}
    String reversao(long id){return baixas()+"/"+id+"/estornar";}
    Map<String,Object> origem(long id,String valor){return Map.of("contaFinanceiraId",id,"valor",valor);}
    @SafeVarargs final Map<String,Object> baixa(String principal,String total,Map<String,Object>... origens) {
        return new HashMap<>(Map.of("chaveRequisicao",UUID.randomUUID().toString(),"dataPagamento",br.com.novexa.erp.time.TempoNovexa.hoje().toString(),
                "principalQuitado",principal,"valorPago",total,"juros","0.00","multa","0.00","desconto","0.00","origens",List.of(origens)));
    }
    void estado(String status,String principal,String residual) throws Exception {
        var c=corpo(call(HttpMethod.GET,"/financeiro/contas-pagar/"+titulo,null,token,200));
        assertThat(c.path("status").asText()).isEqualTo(status);
        assertThat(c.path("principalQuitado").decimalValue()).isEqualByComparingTo(principal);
        assertThat(c.path("saldoPendente").decimalValue()).isEqualByComparingTo(residual);
    }
    @Test void duasDatasTresMovimentosQuitacaoEEstornoDeBaixaAnterior() throws Exception {
        jdbc.update("update contas_pagar set valor=1245.87 where id=?",titulo);
        jdbc.update("update contas_financeiras set saldo_inicial=2000,saldo_atual=2000 where id=?",segunda);
        var a=baixa("500","500",origem(segunda,"500"));a.put("dataPagamento","2026-10-01");
        long id=corpo(call(HttpMethod.POST,baixas(),a,token,200)).path("id").asLong();
        estado("PARCIALMENTE_PAGA","500","745.87");
        // Cliente V62 que omite principal quita o residual, não o original.
        var b=baixa("745.87","745.87",origem(financeira,"200"),origem(segunda,"545.87"));b.remove("principalQuitado");
        long id2=corpo(call(HttpMethod.POST,baixas(),b,token,200)).path("id").asLong();
        estado("PAGA","1245.87","0");
        assertThat(jdbc.queryForObject("select count(*) from movimentacoes_financeiras where empresa_id=?",Long.class,empresa)).isEqualTo(3);
        call(HttpMethod.POST,estornar(),Map.of(),token,409); // contrato singular não escolhe uma entre várias
        call(HttpMethod.POST,reversao(id),Map.of("motivoEstorno","Rever primeira baixa"),token,200);
        estado("PARCIALMENTE_PAGA","745.87","500");
        assertThat(jdbc.queryForObject("select estado from pagamentos_conta_pagar where id=?",String.class,id2)).isEqualTo("CONFIRMADO");
        call(HttpMethod.POST,reversao(id2),Map.of("motivoEstorno","Rever segunda baixa"),token,200);
        estado("ABERTA","0","1245.87");assertThat(saldo()).isEqualByComparingTo("1000");
        assertThat(jdbc.queryForObject("select saldo_atual from contas_financeiras where id=?",BigDecimal.class,segunda)).isEqualByComparingTo("2000");
    }
    @Test void encargosNaoAmortizamPrincipalEResumoSomaBaixasNaoOrigens() throws Exception {
        var p=baixa("500","510",origem(financeira,"200"),origem(segunda,"310"));p.put("juros","15");p.put("desconto","5");
        long id=corpo(call(HttpMethod.POST,baixas(),p,token,200)).path("id").asLong();estado("PARCIALMENTE_PAGA","500","145");
        var resumo=corpo(call(HttpMethod.GET,"/financeiro/contas-pagar/resumo",null,token,200));
        assertThat(resumo.path("emAberto").path("total").decimalValue()).isEqualByComparingTo("145");
        assertThat(resumo.path("vencidas").path("total").decimalValue()).isEqualByComparingTo("145");
        assertThat(resumo.path("pagasMes").path("total").decimalValue()).isEqualByComparingTo("510");
        assertThat(resumo.path("pagasMes").path("quantidade").asInt()).isEqualTo(1);
        var finalizacao=baixa("145","146.25",origem(financeira,"146.25"));finalizacao.put("multa","1.25");
        call(HttpMethod.POST,baixas(),finalizacao,token,200);estado("PAGA","645","0");
        resumo=corpo(call(HttpMethod.GET,"/financeiro/contas-pagar/resumo",null,token,200));
        assertThat(resumo.path("pagasMes").path("total").decimalValue()).isEqualByComparingTo("656.25");
        assertThat(resumo.path("pagasMes").path("quantidade").asInt()).isEqualTo(2);
        call(HttpMethod.POST,reversao(id),Map.of("motivoEstorno","Teste encargos"),token,200);
        estado("PARCIALMENTE_PAGA","145","500");
        assertThat(corpo(call(HttpMethod.GET,baixas(),null,token,200)).path("items").size()).isEqualTo(2);
    }
    @Test void replayPreservaIdentidadeMesmoDepoisDeOutrasBaixasEEstorno() throws Exception {
        var p=baixa("100.01","100.01",origem(financeira,"100.01"));
        var id=corpo(call(HttpMethod.POST,baixas(),p,token,200)).path("id").asLong();
        call(HttpMethod.POST,baixas(),baixa("200","200",origem(segunda,"200")),token,200);
        assertThat(corpo(call(HttpMethod.POST,baixas(),p,token,200)).path("id").asLong()).isEqualTo(id);
        estado("PARCIALMENTE_PAGA","300.01","344.99");
        p.put("principalQuitado","100.02");p.put("valorPago","100.02");p.put("origens",List.of(origem(financeira,"100.02")));
        call(HttpMethod.POST,baixas(),p,token,409);
        call(HttpMethod.POST,reversao(id),Map.of("motivoEstorno","Replay"),token,200);
        p.put("principalQuitado","100.01");p.put("valorPago","100.01");p.put("origens",List.of(origem(financeira,"100.01")));
        assertThat(corpo(call(HttpMethod.POST,baixas(),p,token,200)).path("estado").asText()).isEqualTo("ESTORNADO");
        assertThat(saldo()).isEqualByComparingTo("1000");estado("PARCIALMENTE_PAGA","200","445");
    }
    @Test void validaPrincipalCentavosSaldoTenantEPermissoes() throws Exception {
        call(HttpMethod.POST,baixas(),baixa("646","646",origem(financeira,"646")),token,409);
        for(String principal:List.of("0","-1","0.001"))call(HttpMethod.POST,baixas(),baixa(principal,"1",origem(financeira,"1")),token,400);
        var p=baixa("100","100",origem(financeira,"100"));
        call(HttpMethod.POST,baixas(),p,externo,404);call(HttpMethod.POST,baixas(),p,null,401);
        jdbc.update("update contas_financeiras set saldo_atual=50 where id=?",segunda);
        call(HttpMethod.POST,baixas(),baixa("100","100",origem(financeira,"40"),origem(segunda,"60")),token,409);
        assertThat(saldo()).isEqualByComparingTo("1000");estado("ABERTA","0","645");
        long id=corpo(call(HttpMethod.POST,baixas(),p,token,200)).path("id").asLong();
        call(HttpMethod.POST,reversao(id),Map.of("motivoEstorno","Sem permissão"),operador,403);
        call(HttpMethod.POST,pagar(),pedido("0","0","0","545"),token,409);
        call(HttpMethod.POST,"/financeiro/contas-pagar/"+titulo+"/cancelar",Map.of(),token,409);
        assertThat(corpo(call(HttpMethod.GET,"/financeiro/contas-pagar?status=PARCIALMENTE_PAGA",null,token,200)).path("totalItems").asInt()).isEqualTo(1);
    }
    @Test void duasBaixasConcorrentesNaoExcedemResidual() throws Exception {
        var start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            Callable<Integer> job=()->{start.await();var h=new HttpHeaders();h.set("Authorization",token);
                return http.postForEntity(baixas(),new HttpEntity<>(baixa("400","400",origem(financeira,"400")),h),String.class).getStatusCode().value();};
            var a=pool.submit(job);var b=pool.submit(job);start.countDown();
            assertThat(List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
        }
        estado("PARCIALMENTE_PAGA","400","245");assertThat(saldo()).isEqualByComparingTo("600");
    }
    @Test void duasBaixasConcorrentesValidasPreservamAmbas() throws Exception {
        var start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            Callable<Long> job=()->{start.await();return corpo(call(HttpMethod.POST,baixas(),baixa("100","100",origem(financeira,"100")),token,200)).path("id").asLong();};
            var a=pool.submit(job);var b=pool.submit(job);start.countDown();assertThat(a.get(20,TimeUnit.SECONDS)).isNotEqualTo(b.get(20,TimeUnit.SECONDS));
        }
        estado("PARCIALMENTE_PAGA","200","445");assertThat(saldo()).isEqualByComparingTo("800");
    }
    @Test void origensExternasEInativasNaoCriamParcial() throws Exception {
        long outraEmpresa=jdbc.queryForObject("select max(id) from empresas where id<>?",Long.class,empresa);
        jdbc.update("update contas_financeiras set empresa_id=? where id=?",outraEmpresa,segunda);
        call(HttpMethod.POST,baixas(),baixa("100","100",origem(segunda,"100")),token,404);
        jdbc.update("update contas_financeiras set empresa_id=?,ativo=false where id=?",empresa,segunda);
        call(HttpMethod.POST,baixas(),baixa("100","100",origem(segunda,"100")),token,409);
        estado("ABERTA","0","645");assertThat(saldo()).isEqualByComparingTo("1000");
    }
    @Test void consultasEPayloadsPermanecemProporcionaisSemNMaisUm() throws Exception {
        var sql=ContaPagarMultiorigemPostgresTest.Sql.statements;
        var medicao=new LinkedHashMap<String,Object>();
        sql.clear();var legado=call(HttpMethod.POST,pagar(),pedido("0","0","0","645"),token,200);
        medicao.put("legadoSql",sql.size());medicao.put("legadoBytes",legado.getBody().getBytes(java.nio.charset.StandardCharsets.UTF_8).length);
        call(HttpMethod.POST,estornar(),Map.of(),token,200);
        sql.clear();var a=call(HttpMethod.POST,baixas(),baixa("100","100",origem(financeira,"100")),token,200);
        medicao.put("parcialUmaOrigemSql",sql.size());medicao.put("parcialUmaOrigemBytes",a.getBody().getBytes(java.nio.charset.StandardCharsets.UTF_8).length);
        sql.clear();var b=call(HttpMethod.POST,baixas(),baixa("100","100",origem(financeira,"40"),origem(segunda,"60")),token,200);
        medicao.put("parcialDuasOrigensSql",sql.size());medicao.put("parcialDuasOrigensBytes",b.getBody().getBytes(java.nio.charset.StandardCharsets.UTF_8).length);
        sql.clear();call(HttpMethod.GET,baixas()+"?size=1",null,token,200);int uma=sql.size();
        sql.clear();var historico=call(HttpMethod.GET,baixas(),null,token,200);int duas=sql.size();
        assertThat(duas).isLessThanOrEqualTo(uma+1);
        assertThat(historico.getBody()).doesNotContain("logomarca","base64");
        medicao.put("historicoUmaBaixaSql",uma);medicao.put("historicoDuasBaixasSql",duas);
        medicao.put("historicoBytes",historico.getBody().getBytes(java.nio.charset.StandardCharsets.UTF_8).length);
        var out=java.nio.file.Path.of("target/sprint23c/performance.json");java.nio.file.Files.createDirectories(out.getParent());
        java.nio.file.Files.writeString(out,json.writerWithDefaultPrettyPrinter().writeValueAsString(medicao));
    }
    @Test void doubleSubmitEEstornoSimultaneoNaoDuplicamDinheiro() throws Exception {
        var p=baixa("400","400",origem(financeira,"150"),origem(segunda,"250"));var start=new CountDownLatch(1);long id;
        try(var pool=Executors.newFixedThreadPool(2)) {
            Callable<Long> job=()->{start.await();return corpo(call(HttpMethod.POST,baixas(),p,token,200)).path("id").asLong();};
            var a=pool.submit(job);var b=pool.submit(job);start.countDown();id=a.get(20,TimeUnit.SECONDS);assertThat(b.get(20,TimeUnit.SECONDS)).isEqualTo(id);
        }
        var startRefund=new CountDownLatch(1);final long pagamento=id;
        try(var pool=Executors.newFixedThreadPool(2)) {
            Callable<String> job=()->{startRefund.await();return corpo(call(HttpMethod.POST,reversao(pagamento),Map.of("motivoEstorno","Concorrente"),token,200)).path("dataEstorno").asText();};
            var a=pool.submit(job);var b=pool.submit(job);startRefund.countDown();assertThat(a.get(20,TimeUnit.SECONDS)).isEqualTo(b.get(20,TimeUnit.SECONDS));
        }
        assertThat(saldo()).isEqualByComparingTo("1000");estado("ABERTA","0","645");
        assertThat(jdbc.queryForObject("select count(*) from movimentacoes_financeiras where empresa_id=? and estornada",Long.class,empresa)).isEqualTo(2);
    }
    @Test void falhaNoSegundoDebitoReverteSomenteATentativa() throws Exception {
        call(HttpMethod.POST,baixas(),baixa("100","100",origem(financeira,"100")),token,200);
        jdbc.execute("create function fail_partial_"+titulo+"() returns trigger language plpgsql as $$ begin if NEW.conta_financeira_id="+segunda+" then raise exception 'synthetic second origin'; end if; return NEW; end $$");
        jdbc.execute("create trigger fail_partial_"+titulo+" before insert on movimentacoes_financeiras for each row execute function fail_partial_"+titulo+"()");
        try {call(HttpMethod.POST,baixas(),baixa("200","200",origem(financeira,"100"),origem(segunda,"100")),token,500);}
        finally {jdbc.execute("drop trigger fail_partial_"+titulo+" on movimentacoes_financeiras");jdbc.execute("drop function fail_partial_"+titulo+"()");}
        estado("PARCIALMENTE_PAGA","100","545");assertThat(saldo()).isEqualByComparingTo("900");
        assertThat(jdbc.queryForObject("select count(*) from pagamentos_conta_pagar where empresa_id=?",Long.class,empresa)).isEqualTo(1);
    }
    @Test void migracaoV62V63PreservaQuitacoesLegadasEGruposComEncargos() throws Exception {
        call(HttpMethod.POST,pagar(),pedido("15.88","0","0","660.88"),token,200);long legado=titulo;
        titulo=criarTitulo();var p=baixa("645","645",origem(segunda,"645"));p.remove("principalQuitado");
        call(HttpMethod.POST,baixas(),p,token,200);
        String schema="parcial_legacy_"+UUID.randomUUID().toString().replace("-","");
        org.flywaydb.core.Flyway.configure().dataSource(URL+"?currentSchema="+schema,"postgres","")
                .schemas(schema).defaultSchema(schema).cleanDisabled(true).target("62").load().migrate();
        var antes=new LinkedHashMap<String,String>();var colunas=new LinkedHashMap<String,String>();
        for(String tabela:List.of("empresas","usuario","contas_financeiras","contas_pagar","pagamentos_conta_pagar","movimentacoes_financeiras")) {
            String cols=jdbc.queryForObject("select string_agg(quote_ident(column_name),',' order by ordinal_position) from information_schema.columns where table_schema=? and table_name=?",String.class,schema,tabela);
            colunas.put(tabela,cols);
            String origem=tabela.equals("contas_pagar") ? cols.replace("movimentacao_financeira_id","NULL").replace("pagamento_atual_id","NULL") : cols;
            jdbc.execute("insert into "+schema+"."+tabela+"("+cols+") select "+origem+" from "+SCHEMA+"."+tabela+" where "+(tabela.equals("empresas")?"id":"empresa_id")+"="+empresa);
        }
        jdbc.execute("update "+schema+".contas_pagar c set movimentacao_financeira_id=s.movimentacao_financeira_id,pagamento_atual_id=s.pagamento_atual_id from "+SCHEMA+".contas_pagar s where s.id=c.id");
        for(var t:colunas.entrySet())antes.put(t.getKey(),jdbc.queryForObject("select md5(coalesce(string_agg(row_to_json(t)::text,',' order by id),'')) from (select "+t.getValue()+" from "+schema+"."+t.getKey()+") t",String.class));
        var flyway=org.flywaydb.core.Flyway.configure().dataSource(URL+"?currentSchema="+schema,"postgres","").schemas(schema).defaultSchema(schema).cleanDisabled(true).load();
        assertThat(flyway.migrate().migrationsExecuted).isEqualTo(1);flyway.validate();
        assertThat(flyway.info().current().getVersion().toString()).isEqualTo("63");
        for(var t:colunas.entrySet())assertThat(jdbc.queryForObject("select md5(coalesce(string_agg(row_to_json(t)::text,',' order by id),'')) from (select "+t.getValue()+" from "+schema+"."+t.getKey()+") t",String.class)).isEqualTo(antes.get(t.getKey()));
        assertThat(jdbc.queryForObject("select principal_quitado from "+schema+".contas_pagar where id=?",BigDecimal.class,legado)).isEqualByComparingTo("645");
        assertThat(jdbc.queryForObject("select valor_pago from "+schema+".contas_pagar where id=?",BigDecimal.class,legado)).isEqualByComparingTo("660.88");
        assertThat(jdbc.queryForObject("select principal_quitado from "+schema+".contas_pagar where id=?",BigDecimal.class,titulo)).isEqualByComparingTo("645");
    }
}
