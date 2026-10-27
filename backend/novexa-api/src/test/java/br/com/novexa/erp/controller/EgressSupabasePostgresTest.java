package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import javax.sql.DataSource;
import java.lang.reflect.*;
import java.sql.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;
import static org.assertj.core.api.Assertions.*;

/** Fixture integralmente sintética da regressão existente de Caixa; mede JDBC, não a cota do provedor. */
@Import(EgressSupabasePostgresTest.Medicao.class)
class EgressSupabasePostgresTest extends CaixaPainelPostgresTest {
    @Autowired EntityManager em;
    @Autowired PlatformTransactionManager tm;
    @Autowired br.com.novexa.erp.service.CaixaOperacionalService operacional;
    static final List<String> SQL = new CopyOnWriteArrayList<>();
    static final AtomicLong BYTES = new AtomicLong();
    static final java.util.concurrent.atomic.AtomicReference<Runnable> APOS_PAGAMENTOS = new java.util.concurrent.atomic.AtomicReference<>();

    @Test void painelMantemMesmoSnapshotQuandoEscritaComitaEntreConsultas() throws Exception {
        var pagamento=jdbc.queryForMap("select id,venda_id from pagamentos where empresa_id=? order by id limit 1",empresa.getId());
        APOS_PAGAMENTOS.set(()->java.util.concurrent.CompletableFuture.runAsync(()->
                new TransactionTemplate(tm).executeWithoutResult(s->{
                    operacional.bloquear(sessao,empresa.getId());
                    jdbc.update("update pagamentos set status='CANCELADO' where id=?",pagamento.get("id"));
                    jdbc.update("update vendas set status='CANCELADA' where id=?",pagamento.get("venda_id"));
                    jdbc.update("insert into movimentacoes_caixa(empresa_id,sessao_id,usuario_id,pagamento_id,chave_requisicao,tipo,valor,data_hora) values (?,?,?,?,?,'ESTORNO_VENDA',10,now())",
                            empresa.getId(),sessao,operador,pagamento.get("id"),UUID.randomUUID());
                })).orTimeout(5,java.util.concurrent.TimeUnit.SECONDS).join());
        try {
            var durante=painel(admin);
            assertThat(APOS_PAGAMENTOS.get()).isNull();
            assertThat(durante.path("resumo").path("totalVendas").asInt()).isEqualTo(850);
            assertThat(durante.path("resumo").path("saldoEsperadoDinheiro").asInt()).isEqualTo(950);
            assertThat(durante.path("vendas").size()).isEqualTo(85);
            var depois=painel(admin);
            assertThat(depois.path("resumo").path("totalVendas").asInt()).isEqualTo(840);
            assertThat(depois.path("resumo").path("saldoEsperadoDinheiro").asInt()).isEqualTo(940);
            assertThat(depois.path("vendas").size()).isEqualTo(84);
        } finally { APOS_PAGAMENTOS.set(null); }
    }

    @Test void alterarOutroCampoSemLerImagemPreservaConteudo() {
        var tx = new TransactionTemplate(tm);
        tx.executeWithoutResult(s -> {
            var e = em.find(EmpresaEntity.class, empresa.getId());
            assertThat(org.hibernate.Hibernate.isPropertyInitialized(e,"logomarca")).isFalse();
            e.setNomeFantasia("Nome atualizado");
        });
        assertThat(jdbc.queryForObject("select logomarca from empresas where id=?",String.class,empresa.getId())).isEqualTo("x".repeat(971611));
        tx.executeWithoutResult(s -> {
            var e = em.find(EmpresaEntity.class,empresa.getId());
            e.setLogomarca("imagem sintetica substituida");
        });
        assertThat(jdbc.queryForObject("select logomarca from empresas where id=?",String.class,empresa.getId())).isEqualTo("imagem sintetica substituida");
    }

    @Test void painelLeSnapshotSemEsperarLockDaEscrita() throws Exception {
        var executor=java.util.concurrent.Executors.newSingleThreadExecutor();
        var bloqueado=new java.util.concurrent.CountDownLatch(1);
        var liberar=new java.util.concurrent.CountDownLatch(1);
        var escrita=executor.submit(()->new TransactionTemplate(tm).executeWithoutResult(s->{
            operacional.bloquear(sessao,empresa.getId()); bloqueado.countDown();
            try { assertThat(liberar.await(10,java.util.concurrent.TimeUnit.SECONDS)).isTrue(); }
            catch(InterruptedException e) {Thread.currentThread().interrupt();throw new RuntimeException(e);}
        }));
        try {
            assertThat(bloqueado.await(5,java.util.concurrent.TimeUnit.SECONDS)).isTrue();
            assertThat(painel(admin).path("resumo").path("saldoEsperadoDinheiro").asInt()).isEqualTo(950);
            assertThat(escrita.isDone()).isFalse();
        } finally { liberar.countDown(); escrita.get(10,java.util.concurrent.TimeUnit.SECONDS); executor.shutdownNow(); }
    }

    @Test void medirOperacoesSemCarregarImagem() throws Exception {
        var resultado = new LinkedHashMap<String,Object>();
        var tx = new TransactionTemplate(tm);
        long produto = jdbc.queryForObject("insert into produtos(empresa_id,nome,unidade_medida,preco_venda,preco_custo,estoque_atual,estoque_minimo,ativo,controla_estoque,data_cadastro) values (?,'Sintetico','UN',10,2,0,0,true,true,now()) returning id",Long.class,empresa.getId());
        long cliente = jdbc.queryForObject("insert into clientes(empresa_id,nome,tipo_pessoa,ativo,data_cadastro) values (?,'Sintetico','FISICA',true,now()) returning id",Long.class,empresa.getId());
        long conta = jdbc.queryForObject("insert into contas_financeiras(empresa_id,nome,tipo,saldo_inicial,saldo_atual,ativo,data_criacao,data_atualizacao) values (?,'Sintetica','OUTROS',0,0,true,now(),now()) returning id",Long.class,empresa.getId());
        long venda = jdbc.queryForObject("select min(id) from vendas where empresa_id=?",Long.class,empresa.getId());
        Map<String,Runnable> operacoes = new LinkedHashMap<>();
        operacoes.put("painel", () -> { try { assertThat(painel(admin).path("resumo").path("totalVendas").asInt()).isEqualTo(850); } catch(Exception e) {throw new RuntimeException(e);} });
        operacoes.put("produto", () -> tx.executeWithoutResult(s -> assertThat(em.find(ProdutoEntity.class,produto).getNome()).isEqualTo("Sintetico")));
        operacoes.put("cliente", () -> tx.executeWithoutResult(s -> assertThat(em.find(ClienteEntity.class,cliente).getNome()).isEqualTo("Sintetico")));
        operacoes.put("venda", () -> tx.executeWithoutResult(s -> assertThat(em.find(VendaEntity.class,venda).getTotal()).isEqualByComparingTo("10")));
        operacoes.put("financeiro", () -> tx.executeWithoutResult(s -> assertThat(em.find(ContaFinanceiraEntity.class,conta).getNome()).isEqualTo("Sintetica")));
        boolean antes = Boolean.getBoolean("novexa.test.egress.before");
        for (var op:operacoes.entrySet()) {
            op.getValue().run();
            var tempos = new ArrayList<Double>();
            for(int i=0;i<5;i++) {
                SQL.clear(); BYTES.set(0); long inicio=System.nanoTime(); op.getValue().run();
                tempos.add((System.nanoTime()-inicio)/1_000_000.0);
            }
            Collections.sort(tempos);
            long logos=SQL.stream().filter(s->s.toLowerCase(Locale.ROOT).contains("logomarca")).count();
            resultado.put(op.getKey(),Map.of("queries",SQL.size(),"selectsWithLogo",logos,
                    "decodedJdbcTextBytes",BYTES.get(),"medianMs",tempos.get(2),"sql",List.copyOf(SQL)));
            if(!antes) {
                assertThat(logos).as(op.getKey()+" não deve buscar logomarca").isZero();
                // 85 vendas sintéticas: referência de 20.351 bytes/6 SQL no painel.
                // Folga de >6x em bytes e 2 SQL aceita evolução, mas detecta uma imagem (~972 KB)
                // ou retorno ao plano legado de 10 SQL. Não compara tempo absoluto.
                assertThat(BYTES.get()).as(op.getKey()+" orçamento JDBC sintético").isLessThan(128 * 1024L);
                assertThat(SQL.size()).as(op.getKey()+" orçamento de consultas")
                        .isLessThanOrEqualTo(op.getKey().equals("painel") ? 8 : 3);
                if(op.getKey().equals("painel")) assertThat(SQL).noneMatch(s->s.toLowerCase(Locale.ROOT).contains("for no key update") || s.toLowerCase(Locale.ROOT).contains("for update"));
            }
        }
        SQL.clear();
        tx.executeWithoutResult(s -> assertThat(em.find(EmpresaEntity.class,empresa.getId()).getLogomarca()).hasSize(971611));
        assertThat(SQL).anyMatch(s->s.contains("logomarca"));
        var pasta=Path.of(System.getProperty("novexa.test.egress.evidence","target/tarefa19-evidence"));Files.createDirectories(pasta);
        json.writerWithDefaultPrettyPrinter().writeValue(pasta.resolve(antes?"before.json":"after.json").toFile(),resultado);
    }

    @TestConfiguration(proxyBeanMethods=false) static class Medicao {
        @Bean static BeanPostProcessor medirJdbc() {
            return new BeanPostProcessor() {
                @Override public Object postProcessAfterInitialization(Object bean,String name) {
                    if(bean instanceof DataSource ds) return proxy(DataSource.class,ds,(method,args,value)->
                            value instanceof Connection c ? connection(c) : value);
                    return bean;
                }
            };
        }
    }
    interface Depois { Object aplicar(Method method,Object[] args,Object value) throws Throwable; }
    static <T> T proxy(Class<T> type,T target,Depois depois) {
        return type.cast(Proxy.newProxyInstance(type.getClassLoader(),new Class<?>[]{type},(p,m,a)->{
            try { return depois.aplicar(m,a,m.invoke(target,a)); }
            catch(InvocationTargetException e) {throw e.getCause();}
        }));
    }
    static Connection connection(Connection c) {
        return proxy(Connection.class,c,(m,a,v)->{
            if(m.getName().equals("prepareStatement") && v instanceof PreparedStatement ps) {
                String text=(String)a[0];
                return proxy(PreparedStatement.class,ps,(pm,pa,pv)->{
                    if(pm.getName().equals("executeQuery") && pv instanceof ResultSet rs) {
                        SQL.add(text);
                        if(text.contains("from pagamentos ")) {
                            var callback=APOS_PAGAMENTOS.getAndSet(null);
                            if(callback!=null) callback.run();
                        }
                        return proxy(ResultSet.class,rs,(rm,ra,rv)->{
                            if(rm.getName().equals("next") && Boolean.TRUE.equals(rv))
                                for(int i=1;i<=rs.getMetaData().getColumnCount();i++) {
                                    String cell=rs.getString(i);
                                    if(cell!=null) BYTES.addAndGet(cell.getBytes(StandardCharsets.UTF_8).length);
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
}
