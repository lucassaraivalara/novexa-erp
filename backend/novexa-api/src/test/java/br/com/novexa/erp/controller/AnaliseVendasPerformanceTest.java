package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.service.JwtService;
import br.com.novexa.erp.support.AutenticacaoTeste;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import static org.assertj.core.api.Assertions.assertThat;

@EnabledIfSystemProperty(named="novexa.test.analise.jdbc-url", matches="jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/postgres")
@EnabledIfSystemProperty(named="novexa.test.performance.disposable", matches="true")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT, properties={
    "spring.config.import=", "spring.jpa.open-in-view=false", "spring.jpa.show-sql=false",
    "novexa.jwt.secret=synthetic-sprint22-key-0123456789012345", "novexa.jwt.expiration-ms=600000",
    "supabase.url=http://127.0.0.1:9", "supabase.secret-key=synthetic-only", "supabase.bucket=test"})
class AnaliseVendasPerformanceTest {
    static final String SCHEMA="dashboard22_"+UUID.randomUUID().toString().replace("-", "");
    @DynamicPropertySource static void properties(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url",()->System.getProperty("novexa.test.analise.jdbc-url")+"?currentSchema="+SCHEMA);
        p.add("spring.datasource.username",()->"novexa_analise_test");p.add("spring.datasource.password",()->"");
        p.add("spring.datasource.driver-class-name",()->"org.postgresql.Driver");
        p.add("spring.jpa.hibernate.ddl-auto",()->"validate");p.add("spring.flyway.enabled",()->"true");
        p.add("spring.flyway.schemas",()->SCHEMA);p.add("spring.flyway.default-schema",()->SCHEMA);
    }
    @LocalServerPort int port;
    @Autowired EmpresaRepository empresas; @Autowired UsuarioRepository usuarios; @Autowired JwtService jwt;
    @Autowired ProdutoRepository produtos; @Autowired VendaRepository vendas; @Autowired ItemVendaRepository itens;
    @Autowired JdbcTemplate jdbc;
    @Autowired com.fasterxml.jackson.databind.ObjectMapper json;
    @Test void volumeHttpSql() throws Exception {
        var root=Path.of("").toAbsolutePath().getParent().getParent();
        var phase=System.getProperty("novexa.perf.phase","after");
        var out=root.resolve(System.getProperty("novexa.perf.output","docs/audits/assets/sprint22-3/"+phase));java.nio.file.Files.createDirectories(out);
        var e=new EmpresaEntity();e.setRazaoSocial("Performance sintetica A");e.setAtivo(true);e=empresas.saveAndFlush(e);
        String token=AutenticacaoTeste.token(usuarios,jwt,e,PerfilUsuario.ADMIN,"02360684663");
        var u=usuarios.findAll().getFirst();
        for(int tenant=0;tenant<2;tenant++) {
            var emp=e;
            if(tenant==1){emp=new EmpresaEntity();emp.setRazaoSocial("Performance sintetica B");emp.setAtivo(true);emp=empresas.saveAndFlush(emp);}
            var usr=u;
            if(tenant==1){AutenticacaoTeste.token(usuarios,jwt,emp,PerfilUsuario.ADMIN,"52998224725");usr=usuarios.findAll().getLast();}
            ProdutoEntity prod=null; for(int k=0;k<20;k++){prod=new ProdutoEntity();prod.setEmpresa(emp);prod.setNome("Produto sintetico");prod.setUnidadeMedida("UN");prod.setPrecoVenda(new BigDecimal("100"));prod.setPrecoCusto(BigDecimal.ZERO);prod.setEstoqueMinimo(BigDecimal.ZERO);prod.setEstoqueAtual(BigDecimal.ZERO);prod.setAtivo(true);prod.setControlaEstoque(true);prod=produtos.saveAndFlush(prod);}
            long eid=emp.getId(),uid=usr.getId(),pid=prod.getId();
            jdbc.update("INSERT INTO categorias_produtos(empresa_id,nome,ativo) SELECT ?, 'Categoria '||g,true FROM generate_series(1,5) g",eid);
            jdbc.update("UPDATE produtos SET categoria_id=CASE WHEN id%6=0 THEN NULL ELSE (SELECT min(id) FROM categorias_produtos WHERE empresa_id=?) + id%5 END WHERE empresa_id=?",eid,eid);
            jdbc.update("INSERT INTO vendas(empresa_id,usuario_id,chave_requisicao,resumo_requisicao,data_hora,data_faturamento,status,subtotal,desconto,total,forma_pagamento,valor_recebido,troco) SELECT ?,?,gen_random_uuid(),'synthetic',timestamp '2026-04-26' + (g%180)*interval '1 day',timestamp '2026-04-26'+(g%180)*interval '1 day',CASE WHEN g%10=0 THEN 'CANCELADA' ELSE 'FATURADA' END,100,CASE WHEN g%3=0 THEN 10 ELSE 0 END,100-CASE WHEN g%3=0 THEN 10 ELSE 0 END,'PIX',NULL,NULL FROM generate_series(1,12000) g WHERE g%180<>7",eid,uid);
            jdbc.update("INSERT INTO itens_venda(venda_id,produto_id,quantidade,preco_unitario,subtotal,nome_produto,ordem,unidade_medida_venda) SELECT id,? - 19 + id%20,1,100,100,'Sintetico',1,'UN' FROM vendas WHERE empresa_id=?",pid,eid);
            jdbc.update("INSERT INTO pagamentos(empresa_id,venda_id,usuario_id,sequencia,chave_requisicao,forma_pagamento,valor,status,data_hora,valor_recebido,troco,forma_pagamento_id) SELECT empresa_id,id,usuario_id,1,gen_random_uuid(),CASE WHEN id%3=0 THEN 'DINHEIRO' WHEN id%3=1 THEN 'PIX' ELSE 'CARTAO_CREDITO' END,total/2,'REGISTRADO',data_hora,CASE WHEN id%3=0 THEN total/2 ELSE NULL END,CASE WHEN id%3=0 THEN 0 ELSE NULL END, CASE WHEN id%3=0 THEN 1 WHEN id%3=1 THEN 2 ELSE 4 END FROM vendas WHERE empresa_id=?",eid);
            jdbc.update("INSERT INTO pagamentos(empresa_id,venda_id,usuario_id,sequencia,chave_requisicao,forma_pagamento,valor,status,data_hora,forma_pagamento_id) SELECT empresa_id,id,usuario_id,2,gen_random_uuid(),'PIX',total/2,'REGISTRADO',data_hora,2 FROM vendas WHERE empresa_id=?",eid);
        }
        java.nio.file.Files.writeString(out.resolve("dimensions.json"),json.writerWithDefaultPrettyPrinter().writeValueAsString(java.util.Map.of(
            "salesByTenant",jdbc.queryForList("SELECT empresa_id,count(*) vendas,count(*) FILTER(WHERE status='CANCELADA') canceladas,count(*) FILTER(WHERE desconto>0) com_desconto,min(data_faturamento) inicio,max(data_faturamento) fim FROM vendas GROUP BY empresa_id ORDER BY empresa_id"),
            "products",jdbc.queryForObject("SELECT count(*) FROM produtos",Long.class),
            "categories",jdbc.queryForObject("SELECT count(*) FROM categorias_produtos",Long.class),
            "items",jdbc.queryForObject("SELECT count(*) FROM itens_venda",Long.class),
            "payments",jdbc.queryForObject("SELECT count(*) FROM pagamentos",Long.class))));
        for (var identity : jdbc.queryForList("SELECT empresa_id,min(id) usuario_id FROM usuario GROUP BY empresa_id")) {
            long eid=((Number)identity.get("empresa_id")).longValue(), uid=((Number)identity.get("usuario_id")).longValue();
            long cid=jdbc.queryForObject("INSERT INTO caixas(empresa_id,descricao,ativo) VALUES (?,'Performance sintética',true) RETURNING id",Long.class,eid);
            jdbc.update("""
                INSERT INTO sessoes_caixa(caixa_id,empresa_id,usuario_abertura_id,usuario_fechamento_id,
                    saldo_inicial,saldo_final,data_abertura,data_fechamento,status,modalidade_conferencia)
                SELECT ?,?,?,?,0,0,timestamp '2026-04-26 09:00:00'+g*interval '1 day'+turno*interval '6 hours',
                       timestamp '2026-04-26 13:00:00'+g*interval '1 day'+turno*interval '6 hours','FECHADO','LEGADA'
                FROM generate_series(0,179) g CROSS JOIN generate_series(0,1) turno WHERE g%7<>0
                """,cid,eid,uid,uid);
            jdbc.update("INSERT INTO sessoes_caixa(caixa_id,empresa_id,usuario_abertura_id,saldo_inicial,data_abertura,status) VALUES (?,?,?,0,timestamp '2026-10-22 22:00:00','ABERTO')",cid,eid,uid);
        }
        java.nio.file.Files.writeString(out.resolve("sessions.json"), json.writeValueAsString(jdbc.queryForList("SELECT empresa_id,count(*) sessoes FROM sessoes_caixa GROUP BY empresa_id ORDER BY empresa_id")));
        jdbc.execute("ANALYZE");
        jdbc.execute("CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public");
        var client=java.net.http.HttpClient.newHttpClient();var result=new java.util.ArrayList<Object>();
        for(int days:new int[]{7,30,180}) for(String route:new String[]{"resumo","pagamentos","categorias"}) {
            String end="2026-10-22",start=java.time.LocalDate.parse(end).minusDays(days-1).toString();
            var req=java.net.http.HttpRequest.newBuilder(java.net.URI.create("http://127.0.0.1:"+port+"/vendas/analise/"+route+"?dataInicial="+start+"&dataFinal="+end)).header("Authorization",token).GET().build();
            for(int w=0;w<3;w++)assertThat(client.send(req,java.net.http.HttpResponse.BodyHandlers.ofByteArray()).statusCode()).isEqualTo(200);
            for(int i=0;i<20;i++) {
                jdbc.execute("SELECT public.pg_stat_statements_reset()");long t=System.nanoTime();
                var response=client.send(req,java.net.http.HttpResponse.BodyHandlers.ofByteArray());double ms=(System.nanoTime()-t)/1e6;
                assertThat(response.statusCode()).isEqualTo(200);
                var body=json.readTree(response.body());if(route.equals("resumo")){((com.fasterxml.jackson.databind.node.ObjectNode)body.get("periodo")).remove("geradoEm");((com.fasterxml.jackson.databind.node.ObjectNode)body.get("periodoAnterior")).remove("geradoEm");}
                var snapshot=out.resolve(route+"-"+days+".json");
                if(i==0){java.nio.file.Files.writeString(snapshot,json.writeValueAsString(body));if(!phase.equals("before"))assertThat(comercial(body).equals((a,b) -> a.isNumber() && b.isNumber() ? a.decimalValue().compareTo(b.decimalValue()) : a.equals(b) ? 0 : 1, comercial(json.readTree(root.resolve("docs/audits/assets/sprint22-3/before/"+route+"-"+days+".json").toFile())))).as(route+" "+days+" dias: indicadores comerciais equivalentes").isTrue();}
                var stat=jdbc.queryForMap("SELECT coalesce(sum(calls),0) calls,coalesce(sum(total_exec_time),0) ms FROM public.pg_stat_statements WHERE query NOT ILIKE '%pg_stat_statements%' AND (query ILIKE '%FROM vendas%' OR query ILIKE '%WITH base%')");
                int expected=route.equals("resumo")?5:route.equals("pagamentos")?(phase.equals("before")?2:1):(phase.equals("before")?3:2);
                assertThat(((Number)stat.get("calls")).intValue()).isEqualTo(expected);
                result.add(java.util.Map.of("route",route,"days",days,"sample",i,"httpMs",ms,"bytes",response.body().length,"sqlCalls",stat.get("calls"),"sqlMs",stat.get("ms"),"encoding",response.headers().firstValue("content-encoding").orElse("identity")));
            }
        }
        var plans=new java.util.LinkedHashMap<String,Object>();
        plans.put("summary",jdbc.queryForList("EXPLAIN (ANALYZE,BUFFERS,FORMAT TEXT) SELECT sum(v.total),count(*) FROM vendas v WHERE v.empresa_id=1 AND v.status='FATURADA' AND v.data_faturamento >= timestamp '2026-10-16' AND v.data_faturamento < timestamp '2026-10-23'",String.class));
        var field=AnaliseVendasRepository.class.getDeclaredField("RATEIO");field.setAccessible(true);
        String rateio=((String)field.get(null)).replace(":empresa","1").replace(":inicio","timestamp '2026-04-26'").replace(":fim","timestamp '2026-10-23'");
        plans.put("categories180",jdbc.queryForList("EXPLAIN (ANALYZE,BUFFERS,FORMAT TEXT) "+rateio+"SELECT categoria_id,categoria,sum(valor) FROM agrupados GROUP BY categoria_id,categoria",String.class));
        java.nio.file.Files.writeString(out.resolve("plans.json"),json.writerWithDefaultPrettyPrinter().writeValueAsString(plans));
        java.nio.file.Files.writeString(out.resolve("measurements.json"),json.writerWithDefaultPrettyPrinter().writeValueAsString(result));
    }

    private com.fasterxml.jackson.databind.JsonNode comercial(com.fasterxml.jackson.databind.JsonNode original) {
        var copy=original.deepCopy();
        if(copy.has("operacao")) {
            ((com.fasterxml.jackson.databind.node.ObjectNode)copy).remove(java.util.List.of("operacao","operacaoAnterior","variacaoMediaDiaria"));
            for(String campo:java.util.List.of("evolucao","evolucaoAnterior"))
                for(var dia:copy.path(campo)) ((com.fasterxml.jackson.databind.node.ObjectNode)dia).remove(java.util.List.of("operado","parcial"));
        }
        return copy;
    }
}
