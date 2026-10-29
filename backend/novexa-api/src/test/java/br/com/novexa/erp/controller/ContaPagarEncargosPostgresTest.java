package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.service.JwtService;
import br.com.novexa.erp.support.AutenticacaoTeste;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named="novexa.test.encargos.jdbc-url", matches="jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/postgres")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT, properties={
    "spring.config.import=", "spring.jpa.open-in-view=false", "spring.jpa.show-sql=false",
    "novexa.jwt.secret=synthetic-encargos-only-key-0123456789", "novexa.jwt.expiration-ms=600000",
    "supabase.url=http://127.0.0.1:9", "supabase.secret-key=synthetic-only", "supabase.bucket=test"})
class ContaPagarEncargosPostgresTest {
    static final String URL=System.getProperty("novexa.test.encargos.jdbc-url");
    static final String SCHEMA="encargos_"+UUID.randomUUID().toString().replace("-", "");
    @DynamicPropertySource static void postgres(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", () -> URL+"?currentSchema="+SCHEMA);
        p.add("spring.datasource.username", () -> "postgres"); p.add("spring.datasource.password", () -> "");
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.jpa.hibernate.ddl-auto", () -> "validate"); p.add("spring.flyway.enabled", () -> "true");
        p.add("spring.flyway.schemas", () -> SCHEMA); p.add("spring.flyway.default-schema", () -> SCHEMA);
    }
    @Autowired TestRestTemplate http; @Autowired ObjectMapper json; @Autowired JdbcTemplate jdbc;
    @Autowired EmpresaRepository empresas; @Autowired UsuarioRepository usuarios; @Autowired JwtService jwt;
    long empresa, financeira, titulo; String token, operador, externo;
    @BeforeEach void fixture() throws Exception {
        var e=new EmpresaEntity(); e.setRazaoSocial("Encargos sintéticos"); e.setAtivo(true); e=empresas.saveAndFlush(e); empresa=e.getId();
        token=AutenticacaoTeste.token(usuarios,jwt,e,PerfilUsuario.ADMIN,Long.toString(71000000000L+empresa*10));
        operador=AutenticacaoTeste.token(usuarios,jwt,e,PerfilUsuario.OPERADOR,Long.toString(71000000001L+empresa*10));
        var outra=new EmpresaEntity(); outra.setRazaoSocial("Outro tenant"); outra.setAtivo(true); outra=empresas.saveAndFlush(outra);
        externo=AutenticacaoTeste.token(usuarios,jwt,outra,PerfilUsuario.ADMIN,Long.toString(71000000000L+outra.getId()*10));
        financeira=jdbc.queryForObject("insert into contas_financeiras(empresa_id,nome,tipo,saldo_inicial,saldo_atual,ativo,data_criacao,data_atualizacao) values (?,'Sintética','COFRE',1000,1000,true,now(),now()) returning id",Long.class,empresa);
        titulo=criarTitulo();
    }
    long criarTitulo() throws Exception { return corpo(call(HttpMethod.POST,"/financeiro/contas-pagar",Map.of("descricao","Compra sintética","valor","645.00","dataVencimento","2026-10-01"),token,201)).path("id").asLong(); }
    ResponseEntity<String> call(HttpMethod method,String path,Object body,String auth,int status) {
        var h=new HttpHeaders(); h.setContentType(MediaType.APPLICATION_JSON); if(auth!=null) h.set("Authorization",auth);
        var r=http.exchange(path,method,new HttpEntity<>(body,h),String.class);
        assertThat(r.getStatusCode().value()).as(path+" "+r.getBody()).isEqualTo(status); return r;
    }
    JsonNode corpo(ResponseEntity<String> r) throws Exception { return json.readTree(r.getBody()); }
    Map<String,Object> pedido(String juros,String multa,String desconto,String total) {
        return new HashMap<>(Map.of("contaFinanceiraId",financeira,"dataPagamento","2026-10-29","valorPago",total,"juros",juros,"multa",multa,"desconto",desconto));
    }
    String pagar() { return "/financeiro/contas-pagar/"+titulo+"/pagar"; }
    String estornar() { return "/financeiro/contas-pagar/"+titulo+"/estornar"; }
    BigDecimal saldo() { return jdbc.queryForObject("select saldo_atual from contas_financeiras where id=?",BigDecimal.class,financeira); }
    @ParameterizedTest @CsvSource({"0,0,0,645.00","15.88,0,0,660.88","0,7.25,0,652.25","0,0,10.50,634.50","15.88,7.25,3.13,665.00","0.10,0.20,0,645.30"})
    void pagaEEstornaExatamenteUmaVez(String j,String m,String d,String total) throws Exception {
        var r=corpo(call(HttpMethod.POST,pagar(),pedido(j,m,d,total),token,200));
        assertThat(r.path("status").asText()).isEqualTo("PAGA"); assertThat(r.path("valor").decimalValue()).isEqualByComparingTo("645.00");
        assertThat(r.path("valorPago").decimalValue()).isEqualByComparingTo(total); assertThat(r.path("juros").decimalValue()).isEqualByComparingTo(j);
        assertThat(r.path("multa").decimalValue()).isEqualByComparingTo(m); assertThat(r.path("desconto").decimalValue()).isEqualByComparingTo(d);
        assertThat(saldo()).isEqualByComparingTo(new BigDecimal("1000.00").subtract(new BigDecimal(total)));
        long movimento=r.path("movimentacaoFinanceiraId").asLong();
        var audit=jdbc.queryForMap("select * from movimentacoes_financeiras where id=?",movimento);
        assertThat(audit.get("origem")).isEqualTo("CONTAS_A_PAGAR"); assertThat(audit.get("usuario_id")).isNotNull();
        assertThat(audit.get("conta_pagar_valor_original")).isEqualTo(new BigDecimal("645.00"));
        assertThat(audit.get("observacao").toString()).contains("Juros:","Multa:","Desconto:");
        call(HttpMethod.POST,pagar(),pedido(j,m,d,total),token,409); assertThat(saldo()).isEqualByComparingTo(new BigDecimal("1000.00").subtract(new BigDecimal(total)));
        call(HttpMethod.POST,estornar(),Map.of(),operador,403);
        var reversao=corpo(call(HttpMethod.POST,estornar(),Map.of(),token,200));
        assertThat(reversao.path("status").asText()).isEqualTo("ABERTA"); assertThat(reversao.path("valorPago").isNull()).isTrue();
        assertThat(saldo()).isEqualByComparingTo("1000.00");
        var estorno=jdbc.queryForMap("select * from movimentacoes_financeiras where id=?",movimento);
        assertThat(estorno.get("estornada")).isEqualTo(true); assertThat(estorno.get("usuario_estorno_id")).isNotNull();
        assertThat(estorno.get("conta_pagar_juros")).isEqualTo(audit.get("conta_pagar_juros"));
        assertThat(estorno.get("valor")).isEqualTo(audit.get("valor"));
        call(HttpMethod.POST,estornar(),Map.of(),token,409); assertThat(saldo()).isEqualByComparingTo("1000.00");
        call(HttpMethod.POST,pagar(),pedido("0","0","0","645"),token,200);
        assertThat(jdbc.queryForObject("select count(*) from movimentacoes_financeiras where conta_financeira_id=?",Long.class,financeira)).isEqualTo(2);
        assertThat(jdbc.queryForObject("select conta_pagar_juros from movimentacoes_financeiras where id=?",BigDecimal.class,movimento)).isEqualByComparingTo(j);
    }
    @ParameterizedTest @CsvSource({"-1,0,0,644","0,-1,0,644","0,0,-1,646","0,0,645,0","0,0,646,-1","15.88,0,0,645","0,0,0,644","0.001,0,0,645.001","999999999999999999,0,0,999999999999999999"})
    void rejeitaValoresSemArredondamentoImplicito(String j,String m,String d,String total) {
        call(HttpMethod.POST,pagar(),pedido(j,m,d,total),token,400); assertThat(saldo()).isEqualByComparingTo("1000.00");
        assertThat(jdbc.queryForObject("select status from contas_pagar where id=?",String.class,titulo)).isEqualTo("ABERTA");
    }
    @Test void legadoSemCamposNovosPermaneceCompativel() {
        var p=pedido("0","0","0","645"); p.remove("juros");p.remove("multa");p.remove("desconto");
        call(HttpMethod.POST,pagar(),p,token,200); call(HttpMethod.POST,estornar(),Map.of(),token,200); assertThat(saldo()).isEqualByComparingTo("1000");
    }
    @Test void saldoInsuficienteEInatividadeNaoGravam() {
        jdbc.update("update contas_financeiras set saldo_atual=650 where id=?",financeira);
        call(HttpMethod.POST,pagar(),pedido("15.88","0","0","660.88"),token,409); assertThat(saldo()).isEqualByComparingTo("650");
        jdbc.update("update contas_financeiras set saldo_atual=1000,ativo=false where id=?",financeira);
        call(HttpMethod.POST,pagar(),pedido("0","0","0","645"),token,409); assertThat(saldo()).isEqualByComparingTo("1000");
    }
    @Test void tenantEAutorizacaoPreservados() {
        call(HttpMethod.POST,pagar(),pedido("0","0","0","645"),null,401);
        call(HttpMethod.POST,pagar(),pedido("0","0","0","645"),externo,404);
        long outraEmpresa=jdbc.queryForObject("select max(id) from empresas where id<>?",Long.class,empresa);
        long contaExterna=jdbc.queryForObject("insert into contas_financeiras(empresa_id,nome,tipo,saldo_inicial,saldo_atual,ativo,data_criacao,data_atualizacao) values (?,'Externa','COFRE',1000,1000,true,now(),now()) returning id",Long.class,outraEmpresa);
        var forjado=pedido("0","0","0","645");forjado.put("contaFinanceiraId",contaExterna);
        call(HttpMethod.POST,pagar(),forjado,token,404);assertThat(saldo()).isEqualByComparingTo("1000");
        // Pagamento segue a política autenticada existente; somente estorno exige ADMIN/GERENTE.
        call(HttpMethod.POST,pagar(),pedido("0","0","0","645"),operador,200);
        call(HttpMethod.POST,estornar(),Map.of(),externo,404); call(HttpMethod.POST,estornar(),Map.of(),operador,403);
    }
    @Test void duasConfirmacoesSimultaneasDebitamUmaVez() throws Exception {
        try(var pool=Executors.newFixedThreadPool(2)) {
            var inicio=new CountDownLatch(1);
            Callable<Integer> tarefa=()->{inicio.await(); var h=new HttpHeaders();h.set("Authorization",token); return http.postForEntity(pagar(),new HttpEntity<>(pedido("15.88","0","0","660.88"),h),String.class).getStatusCode().value();};
            var a=pool.submit(tarefa); var b=pool.submit(tarefa); inicio.countDown();
            assertThat(List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
        }
        assertThat(saldo()).isEqualByComparingTo("339.12");
        assertThat(jdbc.queryForObject("select count(*) from movimentacoes_financeiras where conta_financeira_id=?",Long.class,financeira)).isEqualTo(1);
    }
    @Test void falhaDepoisDoDebitoDesfazTituloSaldoEMovimento() {
        jdbc.execute("create function falha_encargos_"+titulo+"() returns trigger language plpgsql as $$ begin if NEW.id="+titulo+" and NEW.status='PAGA' then raise exception 'falha sintetica'; end if; return NEW; end $$");
        jdbc.execute("create trigger falha_encargos_"+titulo+" before update on contas_pagar for each row execute function falha_encargos_"+titulo+"()");
        try {
            call(HttpMethod.POST,pagar(),pedido("15.88","0","0","660.88"),token,500);
            assertThat(saldo()).isEqualByComparingTo("1000");
            assertThat(jdbc.queryForObject("select status from contas_pagar where id=?",String.class,titulo)).isEqualTo("ABERTA");
            assertThat(jdbc.queryForObject("select count(*) from movimentacoes_financeiras where conta_financeira_id=?",Long.class,financeira)).isZero();
        } finally { jdbc.execute("drop trigger falha_encargos_"+titulo+" on contas_pagar"); }
    }
    @Test void migracaoV60V61PreservaLegadoEValida() {
        String legado=SCHEMA+"_legado";
        var config=org.flywaydb.core.Flyway.configure().dataSource(URL+"?currentSchema="+legado,"postgres","")
                .schemas(legado).defaultSchema(legado).cleanDisabled(true);
        config.target("60").load().migrate();
        for(String tabela:List.of("empresas","usuario","contas_financeiras","movimentacoes_financeiras","contas_pagar")) {
            String colunas=jdbc.queryForObject("select string_agg(quote_ident(column_name),',' order by ordinal_position) from information_schema.columns where table_schema=? and table_name=?",String.class,legado,tabela);
            jdbc.execute("insert into "+legado+"."+tabela+"("+colunas+") select "+colunas+" from "+SCHEMA+"."+tabela);
        }
        var antes=new LinkedHashMap<String,String>();
        for(String tabela:List.of("empresas","usuario","contas_financeiras","contas_pagar"))
            antes.put(tabela,jdbc.queryForObject("select md5(coalesce(string_agg(row_to_json(t)::text,',' order by id),'')) from "+legado+"."+tabela+" t",String.class));
        var flyway=org.flywaydb.core.Flyway.configure().dataSource(URL+"?currentSchema="+legado,"postgres","")
                .schemas(legado).defaultSchema(legado).cleanDisabled(true).load();
        assertThat(flyway.migrate().migrationsExecuted).isEqualTo(1); flyway.validate();
        assertThat(flyway.info().current().getVersion().toString()).isEqualTo("61");
        for(var item:antes.entrySet()) assertThat(jdbc.queryForObject("select md5(coalesce(string_agg(row_to_json(t)::text,',' order by id),'')) from "+legado+"."+item.getKey()+" t",String.class)).isEqualTo(item.getValue());
        assertThat(jdbc.queryForObject("select count(*) from "+legado+".movimentacoes_financeiras where conta_pagar_juros is not null",Long.class)).isZero();
    }
    @Test void falhaNaReaberturaDesfazEstornoESaldo() throws Exception {
        var pago=corpo(call(HttpMethod.POST,pagar(),pedido("15.88","0","0","660.88"),token,200));
        jdbc.execute("create function falha_estorno_"+titulo+"() returns trigger language plpgsql as $$ begin if NEW.id="+titulo+" and NEW.status='ABERTA' then raise exception 'falha sintetica estorno'; end if; return NEW; end $$");
        jdbc.execute("create trigger falha_estorno_"+titulo+" before update on contas_pagar for each row execute function falha_estorno_"+titulo+"()");
        try {
            call(HttpMethod.POST,estornar(),Map.of(),token,500);
            assertThat(saldo()).isEqualByComparingTo("339.12");
            assertThat(jdbc.queryForObject("select status from contas_pagar where id=?",String.class,titulo)).isEqualTo("PAGA");
            assertThat(jdbc.queryForObject("select estornada from movimentacoes_financeiras where id=?",Boolean.class,pago.path("movimentacaoFinanceiraId").asLong())).isFalse();
        } finally {jdbc.execute("drop trigger falha_estorno_"+titulo+" on contas_pagar");}
    }
}
