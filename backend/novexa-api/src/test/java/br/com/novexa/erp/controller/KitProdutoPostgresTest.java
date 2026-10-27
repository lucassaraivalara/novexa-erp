package br.com.novexa.erp.controller;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.test.context.*;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.beans.factory.annotation.Autowired;
import org.flywaydb.core.Flyway;
import java.util.UUID;
import java.sql.DriverManager;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@EnabledIfSystemProperty(named="novexa.test.kit.jdbc-url",matches="jdbc:postgresql:.*")
@Sql(statements={"delete from formas_pagamento", "insert into formas_pagamento(id,descricao,tipo,ativo) values (1,'Dinheiro','DINHEIRO',true),(2,'PIX','PIX',true),(3,'Debito','DEBITO',true),(4,'Credito','CREDITO',true),(5,'Boleto','BOLETO',true),(6,'Transferencia','TRANSFERENCIA',true)","alter sequence formas_pagamento_id_seq restart with 7"})
class KitProdutoPostgresTest extends KitProdutoHttpTest {
    static final String SCHEMA="kit_"+UUID.randomUUID().toString().replace("-","");
    static final String URL=System.getProperty("novexa.test.kit.jdbc-url");
    @Autowired Flyway flyway;
    @DynamicPropertySource static void properties(DynamicPropertyRegistry p) {
        if(!URL.matches("jdbc:postgresql://(127\\.0\\.0\\.1|localhost):[0-9]+/.*"))throw new IllegalStateException("Somente PostgreSQL descartável local.");
        p.add("spring.datasource.url",()->URL+"?currentSchema="+SCHEMA);p.add("spring.datasource.username",()->"postgres");
        p.add("spring.datasource.password",()->"synthetic-test-password");p.add("spring.datasource.driver-class-name",()->"org.postgresql.Driver");
        p.add("spring.flyway.enabled",()->true);p.add("spring.flyway.schemas",()->SCHEMA);p.add("spring.flyway.default-schema",()->SCHEMA);
        p.add("spring.jpa.hibernate.ddl-auto",()->"validate");
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({"true,true", "true,false", "false,true", "false,false"})
    void matrizEmpresaProdutoPreservaVendaRetryECancelamento(boolean empresaControla, boolean produtoControla) throws Exception {
        empresa.setControlaEstoque(empresaControla); empresas.saveAndFlush(empresa);
        produto.setControlaEstoque(produtoControla); produtos.saveAndFlush(produto);
        var pedido=pedidoKit(produto.getId(),1);
        var r=vender(pedido).andExpect(status().isCreated()).andReturn();
        long id=json.readTree(r.getResponse().getContentAsString()).get("id").asLong();
        boolean efetivo=empresaControla && produtoControla;
        assertThat(jdbc.queryForObject("select controle_estoque_aplicado from itens_venda where venda_id=?",Boolean.class,id)).isEqualTo(efetivo);
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo(efetivo?"9":"10");
        assertThat(movimentos.count()).isEqualTo(efetivo?1:0);
        empresa.setControlaEstoque(!empresaControla); empresas.saveAndFlush(empresa);
        vender(pedido).andExpect(status().isCreated());
        mvc.perform(post("/vendas/"+id+"/cancelar").header("Authorization",authorization)).andExpect(status().isOk());
        mvc.perform(post("/vendas/"+id+"/cancelar").header("Authorization",authorization)).andExpect(status().isOk());
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
        assertThat(movimentos.count()).isEqualTo(efetivo?2:0);
        assertThat(produtos.findById(produto.getId()).orElseThrow().getControlaEstoque()).isEqualTo(produtoControla);
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(booleans={true,false})
    void kitCancelaConformePoliticaOriginalMesmoAposMudanca(boolean controlar) throws Exception {
        long kitId=kit(2,1,"UN");
        empresa.setControlaEstoque(controlar); empresas.saveAndFlush(empresa);
        var p=pedidoKit(kitId,1);
        long id=json.readTree(vender(p).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();
        assertThat(movimentos.count()).isEqualTo(controlar?1:0);
        empresa.setControlaEstoque(!controlar); empresas.saveAndFlush(empresa);
        vender(p).andExpect(status().isCreated());
        mvc.perform(post("/vendas/"+id+"/cancelar").header("Authorization",authorization)).andExpect(status().isOk());
        assertThat(movimentos.count()).isEqualTo(controlar?2:0);
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
        assertThat(jdbc.queryForObject("select count(*) from consumos_kit_venda",Integer.class)).isEqualTo(controlar?1:0);
    }
    @Test void empresaSemControleVendeKitSemSaldoEReativacaoNaoReprocessa() throws Exception {
        long kitId=kit(2,1,"UN");
        produto.setEstoqueAtual(java.math.BigDecimal.ZERO); produtos.saveAndFlush(produto);
        empresa.setControlaEstoque(false); empresas.saveAndFlush(empresa);
        vender(pedidoKit(kitId,3)).andExpect(status().isCreated());
        assertThat(movimentos.count()).isZero();
        empresa.setControlaEstoque(true); empresas.saveAndFlush(empresa);
        vender(pedidoKit(kitId,1)).andExpect(status().isConflict());
        assertThat(movimentos.count()).isZero();
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("0");
    }

    @Test void mudancaDeConfiguracaoAguardaVendaELimiteTransacionalPreservaSnapshot() throws Exception {
        // Barreira exclusivamente no schema descartavel: pausa o INSERT real, sem mockar JPA.
        jdbc.execute("create function pausa_stock59() returns trigger language plpgsql as $$ begin perform pg_advisory_xact_lock(717170001); return NEW; end $$");
        jdbc.execute("create trigger pausa_stock59 before insert on pagamentos for each row execute function pausa_stock59()");
        try(var c=DriverManager.getConnection(URL,"postgres","synthetic-test-password");var statement=c.createStatement();
                var pool=java.util.concurrent.Executors.newFixedThreadPool(2)) {
            statement.execute("select pg_advisory_lock(717170001)");
            var venda=pool.submit(() -> vender(pedidoKit(produto.getId(),1)).andExpect(status().isCreated()).andReturn());
            java.util.concurrent.Future<Long> alterar=null;
            try {
                long limite=System.nanoTime()+java.util.concurrent.TimeUnit.SECONDS.toNanos(10);
                boolean aguardando=false;
                while(System.nanoTime()<limite) {
                    aguardando=jdbc.queryForObject("select count(*) from pg_stat_activity where datname=current_database() and wait_event='advisory' and query like '%pagamentos%'",Integer.class)>0;
                    if(aguardando)break;
                    if(venda.isDone())venda.get();
                    Thread.sleep(25);
                }
                assertThat(aguardando).isTrue();
                var iniciou=new java.util.concurrent.CountDownLatch(1);
                alterar=pool.submit(() -> new org.springframework.transaction.support.TransactionTemplate(transactions).execute(status -> {
                    iniciou.countDown(); var e=empresas.politicaParaAlterar(empresa.getId()).orElseThrow(); e.setControlaEstoque(false); return e.getId();
                }));
                assertThat(iniciou.await(5,java.util.concurrent.TimeUnit.SECONDS)).isTrue();
                var pendente=alterar;
                assertThatThrownBy(() -> pendente.get(300,java.util.concurrent.TimeUnit.MILLISECONDS)).isInstanceOf(java.util.concurrent.TimeoutException.class);
            } finally { statement.execute("select pg_advisory_unlock(717170001)"); }
            venda.get(15,java.util.concurrent.TimeUnit.SECONDS); alterar.get(15,java.util.concurrent.TimeUnit.SECONDS);
            assertThat(jdbc.queryForObject("select controle_estoque_aplicado from itens_venda",Boolean.class)).isTrue();
            assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("9");
            vender(pedidoKit(produto.getId(),1)).andExpect(status().isCreated());
            assertThat(movimentos.count()).isEqualTo(1);
            assertThat(jdbc.queryForObject("select count(*) from itens_venda where controle_estoque_aplicado=false",Integer.class)).isEqualTo(1);
        } finally { jdbc.execute("drop trigger pausa_stock59 on pagamentos");jdbc.execute("drop function pausa_stock59()"); }
    }

    @Test void schemaAtualV59Validado() { flyway.validate();assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("59"); }
    @AfterAll static void limparSchema() throws Exception {
        try(var c=DriverManager.getConnection(URL,"postgres","synthetic-test-password");var s=c.createStatement()){s.execute("drop schema if exists "+SCHEMA+" cascade");}
    }
}
