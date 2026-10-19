package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.service.JwtService;
import br.com.novexa.erp.support.AutenticacaoTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.util.stream.Stream;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:busca-paginada;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.username=sa", "spring.datasource.password=", "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false",
    "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=60000"
})
@AutoConfigureMockMvc
@Transactional
class BuscaPaginadaHttpTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired JwtService jwt;
    EmpresaEntity empresaA, empresaB;
    String tokenA, tokenB;
    long baseA, baseB;

    record Consulta(String url, String busca, String situacao, String ativa, String inativa) {
        boolean empresa() { return url.equals("/empresas/pagina"); }
        int quantidade() { return empresa() ? 1 : 3; }
        @Override public String toString() { return url; }
    }
    static Stream<Consulta> consultas() {
        return Stream.of(
            new Consulta("/empresas/pagina", "termo", "ativo", "true", "false"),
            new Consulta("/financeiro/contas-financeiras/pagina", "termo", "ativo", "true", "false"),
            new Consulta("/financeiro/contas-pagar", "busca", "status", "ABERTA", "CANCELADA"),
            new Consulta("/financeiro/contas-receber/pagina", "termo", "status", "PENDENTE", "CANCELADA"),
            new Consulta("/clientes", "busca", "situacao", "ativos", "inativos"),
            new Consulta("/fornecedores", "termo", "ativo", "true", "false"),
            new Consulta("/produtos", "busca", "situacao", "ativos", "inativos"),
            new Consulta("/estoque/entradas", "termo", "status", "RASCUNHO", "CONFIRMADA"),
            new Consulta("/produtos/categorias", "termo", "ativo", "true", "false"),
            new Consulta("/produtos/subcategorias", "termo", "ativo", "true", "false"),
            new Consulta("/produtos/marcas", "termo", "ativo", "true", "false"));
    }
    static Stream<Arguments> buscas() {
        return consultas().flatMap(c -> Stream.of(null, "", "   ", " \t\n ", "  AlFa  ").map(t -> Arguments.of(c, t)));
    }

    @BeforeEach void preparar() {
        empresaA = empresa("Alfa A", "11222333000181");
        empresaB = empresa("Alfa B", "12345678000190");
        tokenA = AutenticacaoTeste.token(usuarios, jwt, empresaA, PerfilUsuario.ADMIN, "12345678909");
        tokenB = AutenticacaoTeste.token(usuarios, jwt, empresaB, PerfilUsuario.ADMIN, "98765432100");
        baseA = empresaA.getId() * 1000; baseB = empresaB.getId() * 1000;
        dados(empresaA.getId(), baseA, 3);
        dados(empresaB.getId(), baseB, 1);
    }

    @ParameterizedTest @MethodSource("buscas")
    void buscaAusenteVaziaBrancaEPreenchidaPreservaTenant(Consulta consulta, String termo) throws Exception {
        var pedido = get(consulta.url()).header("Authorization", tokenA)
            .param("empresaId", empresaB.getId().toString()).param("sort", "id,asc");
        if (termo != null) pedido.param(consulta.busca(), termo);
        int total = consulta.empresa() ? 1 : termo != null && !termo.isBlank() ? 2 : 3;
        long primeiro = consulta.empresa() ? empresaA.getId() : baseA + 1;
        mvc.perform(pedido).andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(total))
            .andExpect(jsonPath("$.items[0].id").value(primeiro));
        mvc.perform(get(consulta.url()).header("Authorization", tokenB).param("empresaId", empresaA.getId().toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1))
            .andExpect(jsonPath("$.items[0].id").value(consulta.empresa() ? empresaB.getId() : baseB + 1));
    }

    @ParameterizedTest @MethodSource("consultas")
    void paginaOrdenacaoESituacaoAplicadasAntesDaContagem(Consulta c) throws Exception {
        mvc.perform(get(c.url()).header("Authorization", tokenA).param("page", "0").param("size", "1").param("sort", "id,desc"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.page").value(0)).andExpect(jsonPath("$.size").value(1))
            .andExpect(jsonPath("$.totalItems").value(c.quantidade())).andExpect(jsonPath("$.totalPages").value(c.quantidade()))
            .andExpect(jsonPath("$.items[0].id").value(c.empresa() ? empresaA.getId() : baseA + 3));
        var pagina = mvc.perform(get(c.url()).header("Authorization", tokenA).param("page", "1").param("size", "1").param("sort", "id,asc"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.page").value(1)).andExpect(jsonPath("$.totalItems").value(c.quantidade()));
        if (c.empresa()) pagina.andExpect(jsonPath("$.items.length()").value(0));
        else pagina.andExpect(jsonPath("$.items[0].id").value(baseA + 2));
        boolean entrada = c.url().equals("/estoque/entradas");
        mvc.perform(get(c.url()).header("Authorization", tokenA).param(c.situacao(), c.ativa()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(c.empresa() ? 1 : entrada ? 3 : 2));
        mvc.perform(get(c.url()).header("Authorization", tokenA).param(c.situacao(), c.inativa()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(c.empresa() || entrada ? 0 : 1));
    }

    @org.junit.jupiter.api.Test void empresaBuscaDocumentoEFantasiaSemAmpliarTenant() throws Exception {
        empresaA.setNomeFantasia("Loja Aurora"); empresas.saveAndFlush(empresaA);
        for (String termo : new String[]{"11.222.333/0001-81", "  lOjA aUrOrA  "})
            mvc.perform(get("/empresas/pagina").header("Authorization", tokenA).param("termo", termo))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(empresaA.getId()));
        for (String termo : new String[]{"Alfa B", "12345678000190"})
            mvc.perform(get("/empresas/pagina").header("Authorization", tokenA).param("termo", termo))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(0));
    }

    @ParameterizedTest @MethodSource("consultas")
    void buscaSemResultadoEFiltrosCombinadosRetornamPaginaVazia(Consulta c) throws Exception {
        for (String page : new String[]{"0", "1"}) {
            mvc.perform(get(c.url()).header("Authorization", tokenA).param(c.busca(), "sem-correspondencia")
                            .param(c.situacao(), c.ativa()).param("page", page).param("size", "1").param("sort", "id,desc"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty())
                    .andExpect(jsonPath("$.totalItems").value(0)).andExpect(jsonPath("$.totalPages").value(0));
        }
    }

    @ParameterizedTest @MethodSource("consultas")
    void buscaPreenchidaComSituacaoMantemContagemEOrdenacao(Consulta c) throws Exception {
        mvc.perform(get(c.url()).header("Authorization", tokenA).param(c.busca(), "  AlFa  ")
                        .param(c.situacao(), c.ativa()).param("size", "1").param("sort", "id,desc"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(c.empresa() ? 1 : 2))
                .andExpect(jsonPath("$.items[0].id").value(c.empresa() ? empresaA.getId() : baseA + 2));
    }

    @ParameterizedTest @MethodSource("consultas")
    void errosDeParametrosEAutenticacaoNaoViraramErroSql(Consulta c) throws Exception {
        mvc.perform(get(c.url()).header("Authorization", tokenA).param("sort", "campoInexistente,asc"))
                .andExpect(status().isBadRequest());
        mvc.perform(get(c.url())).andExpect(status().isUnauthorized());
    }

    static Stream<Arguments> buscasUsuarios() {
        return Stream.of(null, "", "   ", " \t\n ", "  Usuario  ", "sem-correspondencia")
                .map(t -> Arguments.of(t));
    }

    @ParameterizedTest @MethodSource("buscasUsuarios")
    void usuariosUsamPadroesTextuaisNaoNulos(String termo) throws Exception {
        var req = get("/usuarios/pagina").header("Authorization", tokenA)
                .param("ativo", "true").param("sort", "nomeUsuario,desc").param("size", "1")
                .param("empresaId", empresaB.getId().toString());
        if (termo != null) req.param("termo", termo);
        mvc.perform(req).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value("sem-correspondencia".equals(termo) ? 0 : 1))
                .andExpect(jsonPath("$.items[0].senha").doesNotExist());
        mvc.perform(get("/usuarios/pagina").header("Authorization", tokenB).param("page", "1").param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty())
                .andExpect(jsonPath("$.totalItems").value(1));
    }

    static Stream<Arguments> lookups() {
        return Stream.of("/clientes/buscar", "/produtos/buscar", "/fornecedores/buscar")
                .flatMap(u -> Stream.of(null, "", "   ", "  AlFa  ", "sem-correspondencia").map(t -> Arguments.of(u, t)));
    }

    @ParameterizedTest @MethodSource("lookups")
    void lookupsPreservamContratoDaBuscaVazia(String url, String termo) throws Exception {
        var req = get(url).header("Authorization", tokenA).param("empresaId", empresaB.getId().toString());
        if (termo != null) req.param("termo", termo);
        if (termo == null && url.equals("/produtos/buscar")) {
            mvc.perform(req).andExpect(status().isBadRequest());
            return;
        }
        int total = "  AlFa  ".equals(termo) ? 2
                : url.equals("/fornecedores/buscar") && (termo == null || termo.isBlank()) ? 2 : 0;
        mvc.perform(req).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(total));
        if (total > 0) mvc.perform(get(url).header("Authorization", tokenB).param("termo", "Alfa"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
    }

    private EmpresaEntity empresa(String nome, String cnpj) {
        var e = new EmpresaEntity(); e.setRazaoSocial(nome); e.setCnpj(cnpj); e.setAtivo(true);
        return empresas.saveAndFlush(e);
    }
    private void dados(long empresa, long base, int quantidade) {
        long usuario = usuarios.findAll().stream().filter(u -> u.getEmpresa().getId().equals(empresa)).findFirst().orElseThrow().getId();
        for (int i = 1; i <= quantidade; i++) {
            long id = base + i; String nome = i < 3 ? "Alfa " + i : "Zeta"; boolean ativo = i < 3;
            jdbc.update("insert into clientes(id,empresa_id,nome,tipo_pessoa,ativo,data_cadastro) values (?,?,?,'FISICA',?,CURRENT_TIMESTAMP)",id,empresa,nome,ativo);
            jdbc.update("insert into fornecedores(id,empresa_id,razao_social,ativo,data_cadastro) values (?,?,?,?,CURRENT_TIMESTAMP)",id,empresa,nome,ativo);
            jdbc.update("insert into categorias_produtos(id,empresa_id,nome,ativo) values (?,?,?,?)",id,empresa,nome,ativo);
            jdbc.update("insert into subcategorias_produtos(id,empresa_id,categoria_id,nome,ativo) values (?,?,?,?,?)",id,empresa,id,nome,ativo);
            jdbc.update("insert into marcas(id,empresa_id,nome,ativo) values (?,?,?,?)",id,empresa,nome,ativo);
            jdbc.update("insert into produtos(id,empresa_id,nome,codigo_interno,unidade_medida,preco_venda,preco_custo,estoque_atual,estoque_minimo,controla_estoque,ativo,composto,composicao_versao,data_cadastro) values (?,?,?,?,'UN',10,0,0,0,true,?,false,0,CURRENT_TIMESTAMP)",id,empresa,nome,"COD"+i,ativo);
            jdbc.update("insert into contas_financeiras(id,empresa_id,nome,tipo,saldo_inicial,saldo_atual,saldo_inicial_auditado,ativo,data_criacao,data_atualizacao) values (?,?,?,'COFRE',0,0,true,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",id,empresa,nome,ativo);
            jdbc.update("insert into contas_pagar(id,empresa_id,descricao,data_vencimento,valor,status) values (?,?,?,DATE '2026-10-01',10,?)",id,empresa,nome,ativo?"ABERTA":"CANCELADA");
            jdbc.update("insert into contas_receber(id,empresa_id,cliente_id,descricao,valor_original,valor_recebido,data_vencimento,status,origem,numero_parcela,total_parcelas,data_criacao,data_atualizacao) values (?,?,?,?,10,0,DATE '2026-10-01',?,'MANUAL',1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",id,empresa,id,nome,ativo?"PENDENTE":"CANCELADA");
            jdbc.update("insert into entradas_mercadoria(id,empresa_id,fornecedor_id,origem,status,numero_nota,data_entrada,valor_produtos,valor_total,data_cadastro,data_atualizacao,usuario_cadastro_id) values (?,?,?,'MANUAL','RASCUNHO',?,DATE '2026-10-01',0,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?)",id,empresa,id,nome,usuario);
        }
    }
}
