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
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT, properties={
    "spring.config.import=", "spring.jpa.open-in-view=false", "spring.jpa.show-sql=false",
    "novexa.jwt.secret=synthetic-sprint22-key-0123456789012345", "novexa.jwt.expiration-ms=600000",
    "supabase.url=http://127.0.0.1:9", "supabase.secret-key=synthetic-only", "supabase.bucket=test"})
class DashboardAnalise22HttpTest {
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
    @Test void navegadorApiPostgresSemDadosProdutivos() throws Exception {
        var e=new EmpresaEntity();e.setRazaoSocial("Sprint22 sintética");e.setAtivo(true);e=empresas.saveAndFlush(e);
        String token=AutenticacaoTeste.token(usuarios,jwt,e,PerfilUsuario.ADMIN,"02360684663");
        var u=usuarios.findAll().getFirst();
        var p=new ProdutoEntity();p.setEmpresa(e);p.setNome("Produto sintético HTTP");p.setUnidadeMedida("UN");p.setPrecoVenda(new BigDecimal("100"));p.setPrecoCusto(BigDecimal.ZERO);p.setEstoqueMinimo(BigDecimal.ZERO);p.setEstoqueAtual(BigDecimal.ZERO);p.setAtivo(true);p.setControlaEstoque(true);p=produtos.saveAndFlush(p);
        var v=new VendaEntity(u,null);v.setSubtotal(new BigDecimal("100"));v.setDesconto(new BigDecimal("10"));v.setTotal(new BigDecimal("90"));v.setStatus(StatusVenda.FATURADA);v=vendas.saveAndFlush(v);
        itens.saveAndFlush(new ItemVendaEntity(v,p,BigDecimal.ONE,new BigDecimal("100"),new BigDecimal("100"),null,1));
        jdbc.update("update vendas set data_faturamento=timestamp '2026-10-22 10:00:00' where id=?",v.getId());
        long antes=jdbc.queryForObject("select count(*) from movimentacoes_financeiras",Long.class);
        var root=Path.of("").toAbsolutePath().getParent().getParent();
        var builder=new ProcessBuilder("node", "tests/sprint22-http-smoke.mjs").directory(root.resolve("frontend").toFile()).redirectErrorStream(true).redirectOutput(root.resolve("backend/novexa-api/target/sprint22/browser-http.log").toFile());
        builder.environment().put("SPRINT22_API","http://127.0.0.1:"+port);builder.environment().put("SPRINT22_TOKEN",token.substring(7));
        var process=builder.start();boolean terminou=process.waitFor(90,TimeUnit.SECONDS);
        if(!terminou)process.destroyForcibly();
        assertThat(terminou).isTrue();assertThat(process.exitValue()).as("See target/sprint22/browser-http.log").isZero();
        assertThat(jdbc.queryForObject("select count(*) from movimentacoes_financeiras",Long.class)).isEqualTo(antes);
    }
}
