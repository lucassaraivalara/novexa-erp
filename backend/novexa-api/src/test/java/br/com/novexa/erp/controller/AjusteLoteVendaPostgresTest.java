package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.AjusteEstoqueLoteDTO.*;
import br.com.novexa.erp.entity.PerfilUsuario;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.AjusteEstoqueLoteService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@EnabledIfSystemProperty(named="novexa.test.20b.jdbc-url",matches="jdbc:postgresql://127.0.0.1:.*")
@Sql(statements={"delete from formas_pagamento", "insert into formas_pagamento(id,descricao,tipo,ativo) values (1,'Dinheiro','DINHEIRO',true),(2,'PIX','PIX',true),(3,'Debito','DEBITO',true),(4,'Credito','CREDITO',true),(5,'Boleto','BOLETO',true),(6,'Transferencia','TRANSFERENCIA',true)","alter sequence formas_pagamento_id_seq restart with 7"})
class AjusteLoteVendaPostgresTest extends VendaHttpTest {
    static final String SCHEMA="ajuste_venda20b_"+UUID.randomUUID().toString().replace("-","");
    @Autowired AjusteEstoqueLoteService lotes;
    @DynamicPropertySource static void pg(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url",()->System.getProperty("novexa.test.20b.jdbc-url")+"?currentSchema="+SCHEMA);
        p.add("spring.datasource.username",()->"postgres");p.add("spring.datasource.password",()->"");
        p.add("spring.datasource.driver-class-name",()->"org.postgresql.Driver");p.add("spring.jpa.hibernate.ddl-auto",()->"validate");
        p.add("spring.flyway.enabled",()->"true");p.add("spring.flyway.schemas",()->SCHEMA);p.add("spring.flyway.default-schema",()->SCHEMA);
    }
    @AfterEach void limparLotes() {jdbc.update("delete from ajustes_estoque_lote");}
    @Test void vendaSimultaneaComitaAntesEAjusteObsoletoNaoSobrescreve() throws Exception {disputar(true);}
    @Test void ajusteComitaAntesEVendaUsaNovoSaldo() throws Exception {disputar(false);}
    void disputar(boolean vendaPrimeiro) throws Exception {
        segundo.setPerfil(PerfilUsuario.ADMIN);usuarios.saveAndFlush(segundo);
        var admin=new UsuarioAutenticado(segundo.getId(),segundo.getCpf(),empresa.getId(),PerfilUsuario.ADMIN);
        var pedido=new Pedido("SALDO_FINAL","Conferencia",UUID.randomUUID(),List.of(new Item(produto.getId(),new BigDecimal("15"),BigDecimal.TEN,null)));
        var gravado=new CountDownLatch(1);var liberar=new CountDownLatch(1);var executor=Executors.newFixedThreadPool(2);
        try {
            var primeiro=executor.submit(()->new TransactionTemplate(transactions).execute(s->{
                try {if(vendaPrimeiro)vender();else lotes.confirmar(pedido,admin);gravado.countDown();assertThat(liberar.await(10,TimeUnit.SECONDS)).isTrue();}
                catch(Exception e){throw new RuntimeException(e);}return null;
            }));
            assertThat(gravado.await(10,TimeUnit.SECONDS)).isTrue();
            var segundo=executor.submit(()->{
                if(vendaPrimeiro)assertThatThrownBy(()->lotes.confirmar(pedido,admin)).hasMessageContaining("409");
                else {try{vender();}catch(Exception e){throw new RuntimeException(e);}}return null;
            });
            // Observe an actual PostgreSQL lock wait instead of relying on thread timing.
            long fim=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);boolean aguardou=false;
            while(System.nanoTime()<fim) {
                aguardou=Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from pg_stat_activity where datname=current_database() and wait_event_type='Lock')",Boolean.class));
                if(aguardou)break;Thread.sleep(10);
            }
            assertThat(aguardou).isTrue();assertThat(segundo.isDone()).isFalse();liberar.countDown();
            primeiro.get(10,TimeUnit.SECONDS);segundo.get(10,TimeUnit.SECONDS);
            assertThat(jdbc.queryForObject("select estoque_atual from produtos where id=?",BigDecimal.class,produto.getId())).isEqualByComparingTo(vendaPrimeiro?"8":"13");
            assertThat(movimentos.count()).isEqualTo(vendaPrimeiro?1:2);
        }finally{liberar.countDown();executor.shutdownNow();}
    }
    void vender() throws Exception {
        var p=Map.of("chaveRequisicao",UUID.randomUUID(),"itens",List.of(Map.of("produtoId",produto.getId(),"quantidade",2,"precoUnitarioEsperado",10)),"desconto",0,"totalEsperado",20,"formaPagamento","DINHEIRO","valorRecebido",20);
        mvc.perform(post("/vendas").header("Authorization",authorization).contentType("application/json").content(json.writeValueAsBytes(p))).andExpect(status().isCreated());
    }
}
