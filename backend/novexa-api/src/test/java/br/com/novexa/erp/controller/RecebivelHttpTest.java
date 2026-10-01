package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.AutowireCapableBeanFactory;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.context.jdbc.Sql;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:recebiveis;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false",
        "spring.jpa.open-in-view=false", "spring.jpa.show-sql=false",
        "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=60000"
})
@AutoConfigureMockMvc
@Sql(statements = {"DELETE FROM formas_pagamento",
        "INSERT INTO formas_pagamento(id,descricao,tipo,ativo) VALUES (1,'Dinheiro','DINHEIRO',true),(2,'PIX','PIX',true),(3,'Debito','DEBITO',true),(4,'Credito','CREDITO',true),(5,'Boleto','BOLETO',true),(6,'Transferencia','TRANSFERENCIA',true)"})
class RecebivelHttpTest {
    @Autowired AutowireCapableBeanFactory beans;
    @MockitoSpyBean RecebivelRepository recebiveis;
    @MockitoSpyBean PagamentoRepository pagamentos;
    @MockitoSpyBean MovimentacaoFinanceiraRepository movimentosFinanceiros;
    VendaHttpTest fluxo;

    @BeforeEach void preparar() {
        fluxo = new VendaHttpTest(); beans.autowireBean(fluxo);
        fluxo.financeiro = beans.getBean(LancamentoFinanceiroRepository.class);
        fluxo.pagamentos = beans.getBean(PagamentoRepository.class);
        fluxo.movimentosFinanceiros = beans.getBean(MovimentacaoFinanceiraRepository.class);
        fluxo.preparar();
    }
    @AfterEach void limpar() { reset(recebiveis); fluxo.limpar(); }

    Map<String, Object> pedido(String tipo) {
        return new HashMap<>(Map.of("chaveRequisicao", UUID.randomUUID(), "itens",
                List.of(Map.of("produtoId", fluxo.produto.getId(), "quantidade", 2, "precoUnitarioEsperado", 10)),
                "desconto", 0, "totalEsperado", 20, "formaPagamento", tipo, "valorRecebido", 20));
    }
    long enviar(Map<String, Object> pedido) throws Exception {
        var resposta = fluxo.mvc.perform(post("/vendas").header("Authorization", fluxo.authorization)
                .contentType("application/json").content(fluxo.json.writeValueAsBytes(pedido)))
                .andExpect(status().isCreated()).andReturn();
        return fluxo.json.readTree(resposta.getResponse().getContentAsString()).get("id").asLong();
    }
    org.springframework.test.web.servlet.ResultActions listar(String query) throws Exception {
        return fluxo.mvc.perform(get("/financeiro/recebiveis" + query).header("Authorization", fluxo.authorization));
    }
    void cancelar(long id) throws Exception {
        fluxo.mvc.perform(post("/vendas/" + id + "/cancelar").header("Authorization", fluxo.authorization))
                .andExpect(status().isOk());
    }

    @ParameterizedTest @ValueSource(strings = {"CARTAO_DEBITO", "CARTAO_CREDITO"})
    void cartaoGeraParcelaUnicaNoTenantSemCreditoEmContaERetryNaoDuplica(String tipo) throws Exception {
        var pedido = pedido(tipo); long id = enviar(pedido);
        assertThat(enviar(pedido)).isEqualTo(id);
        assertThat(recebiveis.count()).isEqualTo(1);
        var r = recebiveis.findAll().getFirst();
        assertThat(r.getEmpresa().getId()).isEqualTo(fluxo.empresa.getId());
        assertThat(r.getVenda().getId()).isEqualTo(id);
        assertThat(r.getNumeroParcela()).isEqualTo(1); assertThat(r.getTotalParcelas()).isEqualTo(1);
        assertThat(r.getTipo().name()).isEqualTo(tipo.replace("CARTAO_", ""));
        assertThat(r.getValorBruto()).isEqualByComparingTo("20");
        assertThat(r.getValorLiquidoPrevisto()).isEqualByComparingTo("20");
        assertThat(r.getDataPrevistaRecebimento()).isNull();
        assertThat(r.getStatus()).isEqualTo(StatusRecebivel.PENDENTE);
        assertThat(fluxo.movimentosFinanceiros.count()).isZero();
        assertThat(fluxo.contasFinanceiras.count()).isZero();
        assertThat(r.getConfiguracaoNomeExibicao()).isNull();
    }
    @ParameterizedTest @ValueSource(strings = {"DINHEIRO", "PIX"})
    void outrosTiposNaoGeramRecebivel(String tipo) throws Exception {
        enviar(pedido(tipo)); assertThat(recebiveis.count()).isZero();
    }
    @Test void cancelamentoPreservaHistoricoERetry() throws Exception {
        long id = enviar(pedido("CARTAO_CREDITO"));
        long recebivelId = recebiveis.findAll().getFirst().getId(); cancelar(id); cancelar(id);
        assertThat(recebiveis.findAll()).singleElement().satisfies(r -> {
            assertThat(r.getId()).isEqualTo(recebivelId); assertThat(r.getStatus()).isEqualTo(StatusRecebivel.CANCELADO);
        });
        assertThat(fluxo.movimentosFinanceiros.count()).isZero();
    }
    @Test void falhaAposCriacaoReverteVendaPagamentoRecebivelEEstoque() {
        doAnswer(invocation -> {
            recebiveis.save((RecebivelEntity) invocation.getArgument(0)); recebiveis.flush();
            throw new IllegalStateException("falha recebivel");
        })
                .when(recebiveis).saveAndFlush(any(RecebivelEntity.class));
        assertThatThrownBy(() -> enviar(pedido("CARTAO_DEBITO"))).hasRootCauseMessage("falha recebivel");
        assertThat(recebiveis.count()).isZero(); assertThat(fluxo.vendas.count()).isZero();
        assertThat(fluxo.pagamentos.count()).isZero(); assertThat(fluxo.movimentos.count()).isZero();
        assertThat(fluxo.financeiro.count()).isZero();
        assertThat(fluxo.produtos.findById(fluxo.produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
    }
    @Test void snapshotNaoMudaQuandoConfiguracaoMuda() throws Exception {
        var destino = fluxo.contasFinanceiras.saveAndFlush(new ContaFinanceiraEntity(fluxo.empresa,
                "Carteira", TipoContaFinanceira.CARTEIRA_DIGITAL, java.math.BigDecimal.ZERO));
        var config = fluxo.configuracoes.saveAndFlush(new ConfiguracaoFormaPagamentoEmpresaEntity(fluxo.empresa,
                fluxo.catalogo.findById(4L).orElseThrow(), "Credito Cielo", true, destino));
        var pedido = pedido("CARTAO_CREDITO"); pedido.put("configuracaoFormaPagamentoId", config.getId());
        enviar(pedido); config.atualizar("Novo nome", false, null); fluxo.configuracoes.saveAndFlush(config);
        var r = recebiveis.findAll().getFirst();
        assertThat(r.getConfiguracaoFormaPagamentoId()).isEqualTo(config.getId());
        assertThat(r.getConfiguracaoTipo()).isEqualTo(TipoFormaPagamento.CREDITO);
        assertThat(r.getConfiguracaoNomeExibicao()).isEqualTo("Credito Cielo");
        listar("").andExpect(jsonPath("$.items[0].configuracaoNomeExibicao").value("Credito Cielo"));
    }
    @Test void liquidadoSemMovimentoBloqueiaCancelamentoComRollback() throws Exception {
        long id = enviar(pedido("CARTAO_DEBITO"));
        fluxo.jdbc.update("update recebiveis set status='LIQUIDADO',data_liquidacao=CURRENT_TIMESTAMP,valor_liquido_recebido=20,usuario_liquidacao_id=?", fluxo.operador.getId());
        fluxo.mvc.perform(post("/vendas/" + id + "/cancelar").header("Authorization", fluxo.authorization))
                .andExpect(status().isConflict());
        assertThat(fluxo.vendas.findById(id).orElseThrow().getStatus()).isEqualTo(StatusVenda.FATURADA);
        assertThat(fluxo.pagamentos.findAll().getFirst().getStatus()).isEqualTo(StatusPagamento.REGISTRADO);
        assertThat(fluxo.produtos.findById(fluxo.produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("8");
        assertThat(fluxo.movimentos.count()).isEqualTo(1);
    }
    @Test void paginaFiltrosCombinadosPeriodoEOrdenacaoDeterministica() throws Exception {
        long debito = enviar(pedido("CARTAO_DEBITO")); long credito = enviar(pedido("CARTAO_CREDITO"));
        cancelar(debito);
        fluxo.jdbc.update("update recebiveis set data_venda=TIMESTAMP '2026-10-01 10:00:00'");
        long maior = recebiveis.findAll().stream().mapToLong(RecebivelEntity::getId).max().orElseThrow();
        listar("?size=1").andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.totalPages").value(2)).andExpect(jsonPath("$.items[0].id").value(maior));
        listar("?page=1&size=1").andExpect(jsonPath("$.page").value(1)).andExpect(jsonPath("$.items.length()").value(1));
        listar("?status=PENDENTE&tipo=CREDITO&vendaId=" + credito + "&dataInicial=2026-10-01&dataFinal=2026-10-01")
                .andExpect(jsonPath("$.totalItems").value(1));
        listar("?status=CANCELADO").andExpect(jsonPath("$.totalItems").value(1));
        listar("?tipo=DEBITO").andExpect(jsonPath("$.totalItems").value(1));
        listar("?dataInicial=2026-10-02").andExpect(jsonPath("$.totalItems").value(0));
        listar("?dataFinal=2026-09-30").andExpect(jsonPath("$.totalItems").value(0));
        listar("?sort=id,asc").andExpect(jsonPath("$.items[1].id").value(maior));
        listar("?sort=id,desc").andExpect(jsonPath("$.items[0].id").value(maior));
        listar("?sort=valorBruto,asc").andExpect(jsonPath("$.items[0].id").value(maior));
    }
    @Test void outroTenantNaoConsultaNemCancela() throws Exception {
        long id = enviar(pedido("CARTAO_CREDITO"));
        var usuario = new UsuarioEntity(); usuario.setEmpresa(fluxo.outra); usuario.setCpf("52998224725");
        usuario.setNomeUsuario("Outro"); usuario.setSenha("hash"); usuario.setPerfil(PerfilUsuario.GERENTE);
        usuario = fluxo.usuarios.saveAndFlush(usuario);
        var token = "Bearer " + fluxo.jwt.gerarToken(usuario);
        fluxo.mvc.perform(get("/financeiro/recebiveis?vendaId=" + id + "&empresaId=" + fluxo.empresa.getId())
                .header("Authorization", token)).andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(0));
        fluxo.mvc.perform(post("/vendas/" + id + "/cancelar").header("Authorization", token)).andExpect(status().isNotFound());
        assertThat(recebiveis.findAll().getFirst().getStatus()).isEqualTo(StatusRecebivel.PENDENTE);
    }
    @ParameterizedTest @ValueSource(strings = {"page=-1", "size=0", "size=101", "sort=empresa,asc", "sort=id,wrong",
            "tipo=PIX", "status=INVALIDO", "dataInicial=2026-10-02&dataFinal=2026-10-01"})
    void parametrosInvalidosRetornam400(String query) throws Exception { listar("?" + query).andExpect(status().isBadRequest()); }
}
