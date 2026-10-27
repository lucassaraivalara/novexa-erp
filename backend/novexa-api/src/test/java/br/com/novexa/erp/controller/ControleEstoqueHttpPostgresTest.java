package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.service.JwtService;
import br.com.novexa.erp.support.AutenticacaoTeste;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import java.math.BigDecimal;
import java.sql.DriverManager;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT, properties={
 "spring.jpa.open-in-view=false", "spring.jpa.show-sql=false", "novexa.jwt.secret=01234567890123456789012345678901",
 "novexa.jwt.expiration-ms=600000", "supabase.url=http://127.0.0.1:9", "supabase.secret-key=synthetic", "supabase.bucket=produtos"})
@EnabledIfSystemProperty(named="novexa.test.entrada.jdbc-url",matches="jdbc:postgresql://(127\\.0\\.0\\.1|localhost):[0-9]+/.*")
class ControleEstoqueHttpPostgresTest {
 static final String URL=System.getProperty("novexa.test.entrada.jdbc-url"), PASSWORD=System.getProperty("novexa.test.entrada.jdbc-password","");
 static final String SCHEMA="http_stock59_"+UUID.randomUUID().toString().replace("-","");
 @DynamicPropertySource static void properties(DynamicPropertyRegistry p) {
  p.add("spring.datasource.url",()->URL+"?currentSchema="+SCHEMA);p.add("spring.datasource.username",()->"postgres");p.add("spring.datasource.password",()->PASSWORD);
  p.add("spring.datasource.driver-class-name",()->"org.postgresql.Driver");p.add("spring.jpa.hibernate.ddl-auto",()->"validate");
  p.add("spring.flyway.enabled",()->true);p.add("spring.flyway.schemas",()->SCHEMA);p.add("spring.flyway.default-schema",()->SCHEMA);
 }
 @Autowired TestRestTemplate http; @Autowired ObjectMapper json; @Autowired JdbcTemplate jdbc;
 @Autowired EmpresaRepository empresas; @Autowired UsuarioRepository usuarios; @Autowired JwtService jwt;
 @Autowired CaixaRepository caixas; @Autowired SessaoCaixaRepository sessoes;
 @AfterAll static void limpar() throws Exception {
  try(var c=DriverManager.getConnection(URL,"postgres",PASSWORD);var s=c.createStatement()){s.execute("drop schema if exists "+SCHEMA+" cascade");}
 }
 JsonNode request(HttpMethod method,String path,String token,Object body,int expected) throws Exception {
  var headers=new HttpHeaders();headers.setContentType(MediaType.APPLICATION_JSON);if(token!=null)headers.set("Authorization",token);
  var response=http.exchange(path,method,new HttpEntity<>(body,headers),String.class);
  assertThat(response.getStatusCode().value()).as(method+" "+path+": "+response.getBody()).isEqualTo(expected);
  if(response.getBody()==null || response.getBody().isBlank())return json.nullNode();
  try{return json.readTree(response.getBody());}catch(com.fasterxml.jackson.core.JsonProcessingException ex){return json.getNodeFactory().textNode(response.getBody());}
 }
 @Test void cicloRealPreservaTenantPoliticaSaldoConversaoEAutoria() throws Exception {
  var e=new EmpresaEntity();e.setRazaoSocial("Empresa sintetica HTTP estoque");e.setCnpj("11222333000181");e.setAtivo(true);e.getCadastro().setRegimeTributario(RegimeTributario.SIMPLES_NACIONAL);e=empresas.saveAndFlush(e);
  var b=new EmpresaEntity();b.setRazaoSocial("Outro tenant sintetico");b.setAtivo(true);b=empresas.saveAndFlush(b);
  var admin=AutenticacaoTeste.token(usuarios,jwt,e,PerfilUsuario.ADMIN,"02360684663");
  var outro=AutenticacaoTeste.token(usuarios,jwt,b,PerfilUsuario.ADMIN,"11144477735");
  var caixa=new CaixaEntity();caixa.setEmpresa(e);caixa.setDescricao("Caixa sintetico");
  var usuario=usuarios.findAll().stream().filter(u->u.getCpf().equals("02360684663")).findFirst().orElseThrow();
  sessoes.saveAndFlush(new SessaoCaixaEntity(caixas.saveAndFlush(caixa),usuario,BigDecimal.ZERO));
  var config=(com.fasterxml.jackson.databind.node.ObjectNode)request(HttpMethod.GET,"/empresas/"+e.getId(),admin,null,200);
  config.put("controlaEstoque",false);
  request(HttpMethod.PUT,"/empresas/"+e.getId(),outro,config,404);
  for(var perfil:List.of(PerfilUsuario.GERENTE,PerfilUsuario.OPERADOR,PerfilUsuario.USUARIO)) {
   var token=AutenticacaoTeste.token(usuarios,jwt,e,perfil,"0000000000"+perfil.ordinal());
   request(HttpMethod.PUT,"/empresas/"+e.getId(),token,config,403);
   request(HttpMethod.GET,"/empresas/"+e.getId(),token,null,200);
  }
  request(HttpMethod.PUT,"/empresas/"+e.getId(),null,config,401);
  assertThat(request(HttpMethod.PUT,"/empresas/"+e.getId(),admin,config,200).path("controlaEstoque").asBoolean()).isFalse();
  long produto=request(HttpMethod.POST,"/produtos",admin,Map.of("nome","Produto HTTP","unidadeMedida","UN","precoVenda",10,"precoCusto",2,"estoqueMinimo",0,"controlaEstoque",true,"ativo",true),201).path("id").asLong();
  request(HttpMethod.POST,"/estoque/movimentacoes/ajuste",admin,Map.of("produtoId",produto,"quantidade",1),201);
  var venda=new HashMap<String,Object>(Map.of("chaveRequisicao",UUID.randomUUID(),"itens",List.of(Map.of("produtoId",produto,"quantidade",2,"precoUnitarioEsperado",10)),"desconto",0,"totalEsperado",20,"formaPagamento","DINHEIRO","valorRecebido",20));
  long id=request(HttpMethod.POST,"/vendas",admin,venda,201).path("id").asLong();
  assertThat(jdbc.queryForObject("select estoque_atual from produtos where id=?",BigDecimal.class,produto)).isEqualByComparingTo("1");
  assertThat(jdbc.queryForObject("select controle_estoque_aplicado from itens_venda where venda_id=?",Boolean.class,id)).isFalse();
  config.put("controlaEstoque",true);request(HttpMethod.PUT,"/empresas/"+e.getId(),admin,config,200);
  assertThat(request(HttpMethod.POST,"/vendas",admin,venda,201).path("id").asLong()).isEqualTo(id);
  request(HttpMethod.POST,"/vendas/"+id+"/cancelar",admin,null,200);
  request(HttpMethod.POST,"/vendas/"+id+"/cancelar",admin,null,200);
  assertThat(jdbc.queryForObject("select estoque_atual from produtos where id=?",BigDecimal.class,produto)).isEqualByComparingTo("1");
  venda.put("chaveRequisicao",UUID.randomUUID());request(HttpMethod.POST,"/vendas",admin,venda,409);
  long fornecedor=request(HttpMethod.POST,"/fornecedores",admin,Map.of("razaoSocial","Fornecedor HTTP","ativo",true),201).path("id").asLong();
  jdbc.update("insert into produto_fornecedor(empresa_id,produto_id,fornecedor_id,fator_conversao) values(?,?,?,0.5)",e.getId(),produto,fornecedor);
  long entrada=request(HttpMethod.POST,"/estoque/entradas",admin,Map.of("fornecedorId",fornecedor,"itens",List.of(Map.of("produtoId",produto,"quantidade","0.003","valorUnitario",10))),201).path("id").asLong();
  request(HttpMethod.POST,"/estoque/entradas/"+entrada+"/confirmar",admin,null,200);
  assertThat(jdbc.queryForObject("select estoque_atual from produtos where id=?",BigDecimal.class,produto)).isEqualByComparingTo("1.002");
  request(HttpMethod.DELETE,"/produtos/"+produto,admin,null,204);
  request(HttpMethod.POST,"/estoque/movimentacoes/entrada",admin,Map.of("produtoId",produto,"quantidade",1),409);
  request(HttpMethod.POST,"/estoque/entradas/"+entrada+"/cancelar",admin,null,200);
  request(HttpMethod.POST,"/estoque/entradas/"+entrada+"/cancelar",admin,null,200);
  assertThat(jdbc.queryForObject("select estoque_atual from produtos where id=?",BigDecimal.class,produto)).isEqualByComparingTo("1");
  assertThat(jdbc.queryForObject("select count(*) from produto_auditoria where produto_id=? and campo='ativo'",Integer.class,produto)).isEqualTo(1);
  assertThat(jdbc.queryForObject("select count(*) from movimentacoes_estoque where empresa_id=?",Integer.class,b.getId())).isZero();
 }
}
