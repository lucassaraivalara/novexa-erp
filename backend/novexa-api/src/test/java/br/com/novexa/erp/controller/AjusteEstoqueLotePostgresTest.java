package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.AjusteEstoqueLoteDTO.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={
    "spring.jpa.hibernate.ddl-auto=validate","spring.flyway.enabled=true","spring.jpa.open-in-view=false",
    "spring.jpa.show-sql=false","novexa.jwt.secret=01234567890123456789012345678901","novexa.jwt.expiration-ms=600000"})
@EnabledIfSystemProperty(named="novexa.test.20b.jdbc-url",matches="jdbc:postgresql://127.0.0.1:.*")
@org.springframework.context.annotation.Import(EgressSupabasePostgresTest.Medicao.class)
class AjusteEstoqueLotePostgresTest {
    static final java.util.concurrent.atomic.AtomicLong CPF=new java.util.concurrent.atomic.AtomicLong(73000000000L);
    static final String SCHEMA="ajuste20b_"+UUID.randomUUID().toString().replace("-","");
    @DynamicPropertySource static void pg(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url",()->System.getProperty("novexa.test.20b.jdbc-url")+"?currentSchema="+SCHEMA);
        p.add("spring.datasource.username",()->"postgres"); p.add("spring.datasource.password",()->"");
        p.add("spring.datasource.driver-class-name",()->"org.postgresql.Driver");
        p.add("spring.flyway.schemas",()->SCHEMA);p.add("spring.flyway.default-schema",()->SCHEMA);
    }
    @Autowired AjusteEstoqueLoteService lotes;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired ProdutoRepository produtos;
    @Autowired MovimentacaoEstoqueService movimentos;
    @Autowired PlatformTransactionManager tm;
    @Autowired JdbcTemplate jdbc;
    @Autowired JwtService jwt;
    @Autowired TestRestTemplate http;
    @Autowired ObjectMapper json;
    EmpresaEntity empresa; UsuarioEntity usuario; ProdutoEntity a,b; UsuarioAutenticado auth;
    @BeforeEach void preparar() {
        empresa=new EmpresaEntity();empresa.setRazaoSocial("Sintetica 20B");empresa.setCnpj(UUID.randomUUID().toString());empresa.setAtivo(true);empresa.setLogomarca("x".repeat(971611));empresa=empresas.saveAndFlush(empresa);
        usuario=new UsuarioEntity();usuario.setEmpresa(empresa);usuario.setCpf(Long.toString(CPF.incrementAndGet()));usuario.setNomeUsuario("Admin");usuario.setSenha("hash sintetico");usuario.setPerfil(PerfilUsuario.ADMIN);usuario.setAtivo(true);usuario=usuarios.saveAndFlush(usuario);
        auth=new UsuarioAutenticado(usuario.getId(),usuario.getCpf(),empresa.getId(),PerfilUsuario.ADMIN);
        a=produto("A");b=produto("B");
    }
    ProdutoEntity produto(String nome) {
        var p=new ProdutoEntity();p.setEmpresa(empresa);p.setNome(nome);p.setCodigoInterno(UUID.randomUUID().toString());p.setUnidadeMedida("UN");p.setPrecoVenda(BigDecimal.TEN);p.setEstoqueAtual(BigDecimal.TEN);p.setControlaEstoque(true);p.setAtivo(true);return produtos.saveAndFlush(p);
    }
    Pedido pedido(ProdutoEntity p,String valor) {return new Pedido("SALDO_FINAL","Contagem teste",null,List.of(new Item(p.getId(),new BigDecimal(valor),null,null)));}
    Pedido confirmar(Pedido p) {
        var previa=lotes.previa(p,auth);
        return new Pedido(p.modo(),p.motivo(),UUID.randomUUID(),previa.itens().stream().map(l->new Item(l.produtoId(),l.saldoFinal(),l.saldoAnterior(),l.ultimaMovimentacaoId())).toList());
    }
    BigDecimal saldo(ProdutoEntity p) {return jdbc.queryForObject("select estoque_atual from produtos where id=?",BigDecimal.class,p.getId());}
    long conta(String tabela) {return jdbc.queryForObject("select count(*) from "+tabela+" where empresa_id=?",Long.class,empresa.getId());}
    @Test void umProdutoZeroFracaoEAuditoriaHistorico() {
        var p=confirmar(pedido(a,"0.125"));var r=lotes.confirmar(p,auth);
        assertThat(r.alterados()).isEqualTo(1);assertThat(saldo(a)).isEqualByComparingTo("0.125");
        var m=jdbc.queryForMap("select * from movimentacoes_estoque where empresa_id=?",empresa.getId());
        assertThat(m).containsEntry("usuario_id",usuario.getId()).containsEntry("tipo","AJUSTE").containsEntry("origem","AJUSTE").containsEntry("motivo",p.motivo());
        assertThat((BigDecimal)m.get("saldo_anterior")).isEqualByComparingTo("10");assertThat((BigDecimal)m.get("saldo_posterior")).isEqualByComparingTo("0.125");assertThat(m.get("data_hora")).isNotNull();
        lotes.confirmar(confirmar(pedido(a,"0")),auth);assertThat(saldo(a)).isZero();
    }
    @Test void maiorMenorIgualELoteInteiroSemAlteracaoPersistemResultado() {
        var c=produto("C");var p=confirmar(new Pedido("SALDO_FINAL","Inventario teste",null,List.of(new Item(a.getId(),new BigDecimal("15"),null,null),new Item(b.getId(),new BigDecimal("7"),null,null),new Item(c.getId(),BigDecimal.TEN,null,null))));
        var r=lotes.confirmar(p,auth);assertThat(r.alterados()).isEqualTo(2);assertThat(r.semAlteracao()).isEqualTo(1);assertThat(conta("movimentacoes_estoque")).isEqualTo(2);
        var noop=confirmar(pedido(c,"10"));assertThat(lotes.confirmar(noop,auth).alterados()).isZero();assertThat(lotes.confirmar(noop,auth)).isEqualTo(lotes.confirmar(noop,auth));assertThat(conta("ajustes_estoque_lote")).isEqualTo(2);
    }
    @Test void previewSemEscritaDuplicadosInexistentesOutroTenant() {
        var p=new Pedido("SALDO_FINAL","Teste",null,List.of(new Item(a.getId(),BigDecimal.ONE,null,null),new Item(a.getId(),BigDecimal.ONE,null,null),new Item(Long.MAX_VALUE,BigDecimal.ONE,null,null)));
        assertThat(lotes.previa(p,auth).itens()).allSatisfy(l->assertThat(l.erros()).isNotEmpty());assertThat(conta("movimentacoes_estoque")).isZero();assertThat(conta("ajustes_estoque_lote")).isZero();
        var outra=new EmpresaEntity();outra.setRazaoSocial("Outra");outra.setCnpj(UUID.randomUUID().toString());outra=empresas.saveAndFlush(outra);
        a.setEmpresa(outra);produtos.saveAndFlush(a);var r=lotes.previa(pedido(a,"1"),auth);assertThat(r.itens().getFirst().nome()).isNull();assertThat(r.itens().getFirst().status()).isEqualTo("INVALIDO");
    }
    @ParameterizedTest @ValueSource(strings={"-1","0.0001","10000000000000000","1E+99999"})
    void quantidadesInvalidas(String valor) {assertThat(lotes.previa(pedido(a,valor),auth).itens().getFirst().status()).isEqualTo("INVALIDO");}
    @ParameterizedTest @ValueSource(strings={"inativo","controle","kit"})
    void cadastroInelegivelDepoisDaPrevia(String caso) {
        var p=confirmar(pedido(a,"2"));jdbc.update("update produtos set "+switch(caso){case "inativo"->"ativo=false";case "controle"->"controla_estoque=false";default->"composto=true,estoque_atual=0,controla_estoque=false";}+" where id=?",a.getId());
        assertThatThrownBy(()->lotes.confirmar(p,auth)).hasMessageContaining("409");assertThat(saldo(a)).isEqualByComparingTo(caso.equals("kit")?"0":"10");assertThat(conta("ajustes_estoque_lote")).isZero();
    }
    @Test void politicaEmpresaDesligadaNaoBloqueiaAjusteExplicito() {var p=confirmar(pedido(a,"3"));jdbc.update("update empresas set controla_estoque=false where id=?",empresa.getId());assertThat(lotes.confirmar(p,auth).alterados()).isEqualTo(1);}
    @Test void itemDeOutraEmpresaImpedeLoteInteiro() {
        var p=confirmar(new Pedido("SALDO_FINAL","Teste",null,List.of(new Item(a.getId(),BigDecimal.ONE,null,null),new Item(b.getId(),BigDecimal.ONE,null,null))));
        var outra=new EmpresaEntity();outra.setRazaoSocial("Outra");outra.setCnpj(UUID.randomUUID().toString());outra=empresas.saveAndFlush(outra);
        jdbc.update("update produtos set empresa_id=? where id=?",outra.getId(),b.getId());
        assertThatThrownBy(()->lotes.confirmar(p,auth)).hasMessageContaining("409");assertThat(saldo(a)).isEqualByComparingTo("10");assertThat(conta("movimentacoes_estoque")).isZero();assertThat(conta("ajustes_estoque_lote")).isZero();
    }
    @Test void chaveTemEscopoEmpresaEMesmoConteudoPorOutroAdminNaoRevelaResultado() {
        var p=confirmar(pedido(a,"2"));lotes.confirmar(p,auth);
        var outro=new UsuarioEntity();outro.setEmpresa(empresa);outro.setCpf(Long.toString(CPF.incrementAndGet()));outro.setNomeUsuario("Outro admin");outro.setSenha("hash");outro.setPerfil(PerfilUsuario.ADMIN);outro.setAtivo(true);outro=usuarios.saveAndFlush(outro);
        var outroAuth=new UsuarioAutenticado(outro.getId(),outro.getCpf(),empresa.getId(),PerfilUsuario.ADMIN);
        assertThatThrownBy(()->lotes.confirmar(p,outroAuth)).hasMessageContaining("409");
        preparar();var novo=confirmar(pedido(a,"4"));novo=new Pedido(novo.modo(),novo.motivo(),p.chaveRequisicao(),novo.itens());
        assertThat(lotes.confirmar(novo,auth).alterados()).isEqualTo(1);assertThat(saldo(a)).isEqualByComparingTo("4");
    }
    @Test void idempotenciaDuravelEConteudoDiferenteRejeitado() {
        var p=confirmar(pedido(a,"2"));var r=lotes.confirmar(p,auth);
        // A segunda chamada abre outra transação e lê o JSON persistido, sem cache de resultado.
        assertThat(lotes.confirmar(p,auth)).isEqualTo(r);assertThat(conta("movimentacoes_estoque")).isEqualTo(1);
        var outro=new Pedido(p.modo(),"Outro motivo",p.chaveRequisicao(),p.itens());assertThatThrownBy(()->lotes.confirmar(outro,auth)).hasMessageContaining("409");
    }
    @Test void duasConfirmacoesMesmaChaveNaoDuplicam() throws Exception {
        var p=confirmar(pedido(a,"2"));var inicio=new CountDownLatch(1);var executor=Executors.newFixedThreadPool(2);
        try {
            Callable<Resultado> c=()->{inicio.await();return lotes.confirmar(p,auth);};var x=executor.submit(c);var y=executor.submit(c);inicio.countDown();
            assertThat(x.get(10,TimeUnit.SECONDS)).isEqualTo(y.get(10,TimeUnit.SECONDS));assertThat(conta("movimentacoes_estoque")).isEqualTo(1);
        }finally{executor.shutdownNow();}
    }
    @Test void doisLotesSimultaneosMesmoProdutoSoUmAplica() throws Exception {
        var p=confirmar(pedido(a,"2"));var q=new Pedido(p.modo(),p.motivo(),UUID.randomUUID(),p.itens());var inicio=new CountDownLatch(1);var executor=Executors.newFixedThreadPool(2);
        try {
            var x=executor.submit(()->tentar(p,inicio));var y=executor.submit(()->tentar(q,inicio));inicio.countDown();
            assertThat(List.of(x.get(10,TimeUnit.SECONDS),y.get(10,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);assertThat(conta("movimentacoes_estoque")).isEqualTo(1);
        }finally{executor.shutdownNow();}
    }
    boolean tentar(Pedido p,CountDownLatch inicio) {try{inicio.await();lotes.confirmar(p,auth);return true;}catch(Exception e){assertThat(e.getMessage()).contains("409");return false;}}
    @Test void movimentoQueVoltaAoSaldoOriginalInvalidaPrevia() {
        var p=confirmar(pedido(a,"2"));movimentos.movimentar(empresa.getId(),a.getId(),usuario.getId(),TipoMovimentacaoEstoque.ENTRADA,OrigemMovimentacaoEstoque.MANUAL,BigDecimal.ONE,"entrada");
        movimentos.movimentar(empresa.getId(),a.getId(),usuario.getId(),TipoMovimentacaoEstoque.SAIDA,OrigemMovimentacaoEstoque.MANUAL,BigDecimal.ONE,"saida");
        assertThatThrownBy(()->lotes.confirmar(p,auth)).hasMessageContaining("Atualize a prévia");assertThat(saldo(a)).isEqualByComparingTo("10");
    }
    @Test void falhaNoSegundoMovimentoReverteTudoERetryFunciona() {
        var p=confirmar(new Pedido("SALDO_FINAL","Teste rollback",null,List.of(new Item(a.getId(),BigDecimal.ONE,null,null),new Item(b.getId(),BigDecimal.ONE,null,null))));
        jdbc.execute("create function falhar_20b() returns trigger language plpgsql as $$ begin if NEW.produto_id="+b.getId()+" then raise exception 'falha sintetica'; end if; return NEW; end; $$");
        jdbc.execute("create trigger falhar_20b before insert on movimentacoes_estoque for each row execute function falhar_20b()");
        try{assertThatThrownBy(()->lotes.confirmar(p,auth)).isInstanceOf(RuntimeException.class);assertThat(saldo(a)).isEqualByComparingTo("10");assertThat(conta("movimentacoes_estoque")).isZero();assertThat(conta("ajustes_estoque_lote")).isZero();}
        finally{jdbc.execute("drop trigger falhar_20b on movimentacoes_estoque");jdbc.execute("drop function falhar_20b()");}
        assertThat(lotes.confirmar(p,auth).alterados()).isEqualTo(2);
    }
    @ParameterizedTest @ValueSource(strings={"ADMIN","GERENTE","OPERADOR","USUARIO"})
    void autorizacaoHttpReal(String perfil) throws Exception {
        usuario.setPerfil(PerfilUsuario.valueOf(perfil));usuarios.saveAndFlush(usuario);
        var h=new HttpHeaders();h.setBearerAuth(jwt.gerarToken(usuario));h.setContentType(MediaType.APPLICATION_JSON);
        var p=pedido(a,"2");var r=http.postForEntity("/estoque/ajustes-lote/previa",new HttpEntity<>(p,h),String.class);
        assertThat(r.getStatusCode().value()).isEqualTo(perfil.equals("ADMIN")?200:403);
        if(perfil.equals("ADMIN")) {
            var pre=json.readValue(r.getBody(),Resultado.class);var l=pre.itens().getFirst();var c=new Pedido("SALDO_FINAL",p.motivo(),UUID.randomUUID(),List.of(new Item(a.getId(),l.saldoFinal(),l.saldoAnterior(),l.ultimaMovimentacaoId())));
            assertThat(http.postForEntity("/estoque/ajustes-lote/confirmar",new HttpEntity<>(c,h),String.class).getStatusCode().value()).isEqualTo(200);
            var historico=http.exchange("/estoque/movimentacoes/produto/"+a.getId(),HttpMethod.GET,new HttpEntity<>(h),String.class);
            assertThat(historico.getStatusCode().value()).isEqualTo(200);assertThat(json.readTree(historico.getBody()).path("items").get(0).path("usuarioId").asLong()).isEqualTo(usuario.getId());
            assertThat(http.getForEntity("/estoque/movimentacoes/produto/"+a.getId(),String.class).getStatusCode().value()).isEqualTo(401);
        }else assertThat(http.postForEntity("/estoque/ajustes-lote/confirmar",new HttpEntity<>(new Pedido("SALDO_FINAL","Teste",UUID.randomUUID(),p.itens()),h),String.class).getStatusCode().value()).isEqualTo(403);
    }
    @Test void motivoChaveModoLimiteObrigatorios() {
        assertThatThrownBy(()->lotes.previa(new Pedido("DIFERENCA","Teste",null,pedido(a,"1").itens()),auth)).hasMessageContaining("400");
        assertThatThrownBy(()->lotes.previa(new Pedido("SALDO_FINAL"," ",null,pedido(a,"1").itens()),auth)).hasMessageContaining("400");
        assertThatThrownBy(()->lotes.confirmar(pedido(a,"1"),auth)).hasMessageContaining("400");
        assertThatThrownBy(()->lotes.previa(new Pedido("SALDO_FINAL","Teste",null,Collections.nCopies(201,pedido(a,"1").itens().getFirst())),auth)).hasMessageContaining("400");
    }
    @Test void limiteDuzentosItensSemConsultasPorItemNaPrevia() {
        var itens=new ArrayList<Item>();for(int i=0;i<200;i++)itens.add(new Item(produto("P"+i).getId(),new BigDecimal("11"),null,null));
        var p=new Pedido("SALDO_FINAL","Limite testado",null,itens);
        EgressSupabasePostgresTest.SQL.clear();EgressSupabasePostgresTest.BYTES.set(0);
        assertThat(lotes.previa(p,auth).itens()).hasSize(200);
        assertThat(EgressSupabasePostgresTest.SQL).hasSize(2).noneMatch(sql->sql.contains("logomarca") || sql.contains("for update"));
        assertThat(EgressSupabasePostgresTest.BYTES.get()).isLessThan(128*1024L);
        long inicio=System.nanoTime();assertThat(lotes.confirmar(confirmar(p),auth).alterados()).isEqualTo(200);
        System.out.println("SPRINT20B_200_CONFIRM_MS="+(System.nanoTime()-inicio)/1_000_000);
        assertThat(conta("movimentacoes_estoque")).isEqualTo(200);
    }
}
