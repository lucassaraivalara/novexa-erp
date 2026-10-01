package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.PerfilUsuario;
import br.com.novexa.erp.service.JwtService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:paginacao;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa", "spring.datasource.password=", "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false", "spring.jpa.open-in-view=false",
        "spring.jpa.show-sql=false", "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=60000"
})
@AutoConfigureMockMvc
@Transactional
class PaginacaoHttpTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired JwtService jwt;
    String token;

    @BeforeEach void preparar() {
        jdbc.update("insert into empresas(id,razao_social) values (1001,'A'),(1002,'B')");
        jdbc.update("insert into usuario(id,empresa_id,nome_usuario,perfil,ativo) values (1001,1001,'Operador','ADMIN',true),(1002,1002,'Outro','ADMIN',true)");
        token = "Bearer " + jwt.gerarToken(1001L, "02360684663", 1001L, PerfilUsuario.ADMIN);
        for (long empresa : new long[]{1001, 1002}) {
            jdbc.update("insert into contas_financeiras(id,empresa_id,nome,tipo,saldo_inicial,saldo_atual,saldo_inicial_auditado,ativo,data_criacao,data_atualizacao) values (?,?,'Cofre','COFRE',100,100,false,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)", empresa, empresa);
            jdbc.update("insert into contas_financeiras(id,empresa_id,nome,tipo,saldo_inicial,saldo_atual,saldo_inicial_auditado,ativo,data_criacao,data_atualizacao) values (?,?,'Destino','COFRE',0,0,false,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)", empresa + 10, empresa);
            for (int i = 1; i <= 3; i++) {
                long id = empresa * 10 + i;
                String nome = i == 3 ? "Zeta" : "Alfa";
                String dia = i == 3 ? "2026-10-02" : "2026-10-01";
                String timestamp = dia + " 12:00:00";
                jdbc.update("insert into clientes(id,empresa_id,nome,nome_fantasia,tipo_pessoa,ativo,data_cadastro,telefone) values (?,?,?,?,'FISICA',?,CURRENT_TIMESTAMP,?)", id, empresa, nome, "Fantasia " + i, i != 3, "Telefone " + i);
                jdbc.update("update clientes set cpf_cnpj=? where id=?", "Documento" + i, id);
                jdbc.update("insert into cliente_enderecos(cliente_id,ordem,logradouro,cidade,uf,principal,entrega) values (?,0,'Rua','Cidade',?, ?,false)", id, i == 1 ? "SP" : i == 2 ? "RJ" : "MG", i != 2);
                jdbc.update("insert into produtos(id,empresa_id,nome,codigo_interno,codigo_barras,unidade_medida,preco_custo,preco_venda,estoque_atual,estoque_minimo,controla_estoque,ativo,data_cadastro) values (?,?,?,?,?,'UN',0,?, ?,5,true,?,CURRENT_TIMESTAMP)", id, empresa, nome, "COD" + i, "BARRA" + i, i * 10, i == 1 ? 0 : i == 2 ? 3 : 10, i != 3);
                jdbc.update("insert into vendas(id,empresa_id,usuario_id,cliente_id,data_hora,status,subtotal,desconto,total) values (?,?,?,?,cast(? as timestamp),?, ?,0,?)", id, empresa, empresa, id, timestamp, i == 3 ? "CANCELADA" : "ABERTA", i * 10, i * 10);
                jdbc.update("insert into contas_pagar(id,empresa_id,descricao,documento,categoria,data_emissao,data_vencimento,valor,status) values (?,?,? ,? ,?,cast(? as date),cast(? as date),?,'ABERTA')", id, empresa, nome, "DOC" + i, i == 3 ? "Outra" : "Operacao", dia, dia, i * 10);
                jdbc.update("insert into movimentacoes_financeiras(id,empresa_id,conta_financeira_id,usuario_id,tipo,origem,descricao,valor,data_movimento,data_criacao,estornada) values (?,?,?,?,?,'MANUAL',?, ?,cast(? as date),CURRENT_TIMESTAMP,false)", id, empresa, empresa, empresa, i == 3 ? "SAIDA" : "ENTRADA", nome, i * 10, dia);
                jdbc.update("insert into movimentacoes_estoque(id,empresa_id,produto_id,usuario_id,tipo,origem,quantidade,saldo_anterior,saldo_posterior,data_hora) values (?,?,?,?,?,'MANUAL',?,0,?,cast(? as timestamp))", id, empresa, empresa * 10 + 1, empresa, i == 3 ? "SAIDA" : "ENTRADA", i, i, timestamp);
                jdbc.update("insert into transferencias_financeiras(id,empresa_id,conta_origem_id,conta_destino_id,usuario_id,valor,data_movimento,status,chave_requisicao,data_criacao) values (?,?,?,?,?,?,cast(? as date),'CONCLUIDA',?,CURRENT_TIMESTAMP)", id, empresa, empresa, empresa + 10, empresa, i * 10, dia, UUID.randomUUID());
            }
        }
    }

    static String endpoint(String recurso) {
        return switch (recurso) {
            case "vendas", "clientes", "produtos" -> "/" + recurso;
            case "estoque" -> "/estoque/movimentacoes/produto/10011";
            default -> "/financeiro/" + recurso;
        };
    }

    @ParameterizedTest @ValueSource(strings = {"vendas", "clientes", "produtos", "contas-pagar", "movimentacoes-financeiras", "estoque", "transferencias"})
    void paginaTotaisTenantValidacoesEId(String recurso) throws Exception {
        String url = endpoint(recurso);
        JsonNode primeira = consultar(url + "?size=2&sort=id,asc&empresaId=1002");
        assertThat(primeira.get("page").asInt()).isZero();
        assertThat(primeira.get("size").asInt()).isEqualTo(2);
        assertThat(primeira.get("totalItems").asLong()).isEqualTo(3);
        assertThat(primeira.get("totalPages").asInt()).isEqualTo(2);
        assertThat(ids(primeira)).containsExactly(10011L, 10012L);
        assertThat(ids(consultar(url + "?page=1&size=2&sort=id,asc"))).containsExactly(10013L);
        assertThat(ids(consultar(url + "?size=2&sort=id,desc"))).containsExactly(10013L, 10012L);
        assertThat(consultar(url).get("size").asInt()).isEqualTo(25);
        for (String invalido : List.of("page=-1", "size=0", "size=101", "sort=empresa.id,asc", "sort=id,invalid", "sort=id", "sort=id,asc,desc"))
            mvc.perform(get(url + "?" + invalido).header("Authorization", token)).andExpect(status().isBadRequest());
    }

    @Test void ordenacoesBancoEDesempate() throws Exception {
        for (String recurso : List.of("vendas", "clientes", "produtos", "contas-pagar", "movimentacoes-financeiras", "estoque", "transferencias")) {
            String campo = switch (recurso) {
                case "vendas", "estoque" -> "dataHora";
                case "clientes", "produtos" -> "nome";
                case "contas-pagar" -> "dataVencimento";
                default -> "dataMovimento";
            };
            boolean descendente = List.of("vendas", "estoque", "movimentacoes-financeiras", "transferencias").contains(recurso);
            assertThat(ids(consultar(endpoint(recurso) + "?size=2&sort=" + campo + ",asc")))
                    .containsExactly(descendente ? 10012L : 10011L, descendente ? 10011L : 10012L);
            assertThat(ids(consultar(endpoint(recurso) + "?size=2&sort=" + campo + ",desc")))
                    .containsExactly(10013L, descendente ? 10012L : 10011L);
        }
        assertThat(ids(consultar("/vendas?sort=total,desc"))).containsExactly(10013L, 10012L, 10011L);
        assertThat(ids(consultar("/vendas?sort=status,asc"))).containsExactly(10012L, 10011L, 10013L);
    }

    @Test void filtrosIsoladosECombinados() throws Exception {
        for (String filtro : List.of("status=ABERTA", "dataInicial=2026-10-01&dataFinal=2026-10-01", "clienteId=10011"))
            assertThat(consultar("/vendas?" + filtro).get("totalItems").asLong()).isEqualTo(filtro.startsWith("cliente") ? 1 : 2);
        assertThat(ids(consultar("/vendas?status=ABERTA&clienteId=10011&dataInicial=2026-10-01&dataFinal=2026-10-01"))).containsExactly(10011L);
        assertThat(ids(consultar("/clientes?situacao=ativos&busca=Fantasia 2&campoBusca=nomeFantasia"))).containsExactly(10012L);
        assertThat(consultar("/clientes?busca=Fantasia&campoBusca=nome").get("totalItems").asLong()).isZero();
        assertThat(consultar("/clientes?busca=Fantasia").get("totalItems").asLong()).isEqualTo(3);
        assertThat(ids(consultar("/produtos?situacao=ativos&busca=COD2&campoBusca=codigoInterno&situacaoEstoque=baixo"))).containsExactly(10012L);
        assertThat(consultar("/produtos?busca=BARRA&campoBusca=nome").get("totalItems").asLong()).isZero();
        assertThat(consultar("/produtos?busca=BARRA").get("totalItems").asLong()).isEqualTo(3);
        assertThat(ids(consultar("/produtos?situacaoEstoque=zerado"))).containsExactly(10011L);
        assertThat(ids(consultar("/produtos?situacaoEstoque=normal"))).containsExactly(10013L);
        assertThat(ids(consultar("/financeiro/contas-pagar?busca=DOC2&status=ABERTA&categoria=Operacao&vencimentoDe=2026-10-01&vencimentoAte=2026-10-01&emissaoDe=2026-10-01&emissaoAte=2026-10-01"))).containsExactly(10012L);
        assertThat(consultar("/financeiro/contas-pagar?fornecedor=999").get("totalItems").asLong()).isZero();
        assertThat(consultar("/financeiro/movimentacoes-financeiras?contaFinanceiraId=1001&tipo=ENTRADA&origem=MANUAL&estornada=false&dataInicial=2026-10-01&dataFinal=2026-10-01").get("totalItems").asLong()).isEqualTo(2);
        assertThat(consultar(endpoint("estoque") + "?tipo=ENTRADA&origem=MANUAL&dataInicial=2026-10-01&dataFinal=2026-10-01").get("totalItems").asLong()).isEqualTo(2);
        assertThat(consultar("/financeiro/transferencias?contaOrigemId=1001&contaDestinoId=1011&status=CONCLUIDA&dataInicial=2026-10-01&dataFinal=2026-10-01").get("totalItems").asLong()).isEqualTo(2);
        mvc.perform(get("/estoque/movimentacoes/produto/10021").header("Authorization", token)).andExpect(status().isNotFound());
        mvc.perform(get("/financeiro/movimentacoes-financeiras?contaFinanceiraId=1002").header("Authorization", token)).andExpect(status().isNotFound());
        assertThat(consultar("/financeiro/transferencias?contaOrigemId=1002").get("totalItems").asLong()).isZero();
        assertThat(consultar("/financeiro/contas-pagar/resumo").get("emAberto").get("quantidade").asLong()).isEqualTo(3);
        assertThat(consultar("/financeiro/contas-pagar/categorias").size()).isEqualTo(2);
    }

    @Test void camposPermitidosEInvalidos() throws Exception {
        String[][] recursos = {
                {"vendas", "id", "dataHora", "total", "status"},
                {"clientes", "id", "nome", "nomeFantasia", "cpfCnpj", "cidadeUf", "telefone", "ativo"},
                {"produtos", "id", "codigoInterno", "nome", "precoVenda", "estoqueAtual", "ativo"},
                {"contas-pagar", "id", "dataVencimento", "dataEmissao", "valor", "status", "categoria"},
                {"movimentacoes-financeiras", "id", "dataMovimento", "tipo", "origem", "valor"},
                {"estoque", "id", "dataHora", "tipo", "origem", "quantidade"},
                {"transferencias", "id", "dataMovimento", "valor", "status"}
        };
        for (String[] recurso : recursos)
            for (int i = 1; i < recurso.length; i++)
                for (String direcao : List.of("asc", "desc"))
                    assertThat(consultar(endpoint(recurso[0]) + "?sort=" + recurso[i] + "," + direcao).get("totalItems").asLong()).isEqualTo(3);
        assertThat(ids(consultar("/clientes?sort=cidadeUf,asc"))).containsExactly(10013L, 10012L, 10011L);
        assertThat(ids(consultar("/clientes?sort=cidadeUf,desc"))).containsExactly(10011L, 10012L, 10013L);
        for (String filtro : List.of("id", "nome", "nomeFantasia", "cpfCnpj", "cidadeUf", "telefone"))
            assertThat(consultar("/clientes?campoBusca=" + filtro + "&busca=" + (filtro.equals("cidadeUf") ? "Cidade" : filtro.equals("id") ? "1001" : "a")).get("items")).isNotNull();
        assertThat(consultar("/clientes?campoBusca=cidadeUf&busca=RJ").get("totalItems").asLong()).isEqualTo(1);
        for (String url : List.of("/clientes?campoBusca=email", "/clientes?situacao=invalid", "/produtos?campoBusca=descricao",
                "/produtos?situacaoEstoque=invalid", "/vendas?dataInicial=2026-10-02&dataFinal=2026-10-01",
                "/financeiro/contas-pagar?vencimentoDe=2026-10-02&vencimentoAte=2026-10-01",
                "/financeiro/movimentacoes-financeiras?tipo=invalid", "/financeiro/transferencias?status=invalid"))
            mvc.perform(get(url).header("Authorization", token)).andExpect(status().isBadRequest());
    }

    JsonNode consultar(String url) throws Exception {
        return json.readTree(mvc.perform(get(url).header("Authorization", token)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }
    List<Long> ids(JsonNode pagina) {
        var ids = new java.util.ArrayList<Long>();
        pagina.get("items").forEach(item -> ids.add(item.get("id").asLong()));
        return ids;
    }
}
