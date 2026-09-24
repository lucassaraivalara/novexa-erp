package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:caixa-operacional;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
    "spring.datasource.username=sa", "spring.datasource.password=", "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false", "spring.jpa.show-sql=false",
    "spring.jpa.open-in-view=false", "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=60000"
})
@AutoConfigureMockMvc
@Sql("/formas-pagamento-fixture.sql")
class CaixaOperacionalHttpTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired CaixaRepository caixas;
    @Autowired SessaoCaixaRepository sessoes;
    @Autowired ProdutoRepository produtos;
    @Autowired VendaRepository vendas;
    @Autowired MovimentacaoCaixaRepository movimentos;
    @Autowired CaixaOperacionalService operacional;
    @Autowired SessaoCaixaService sessoesService;
    @Autowired VendaService vendaService;
    @Autowired PagamentoRepository pagamentos;
    @Autowired JwtService jwt;
    @Autowired PlatformTransactionManager transactions;
    @Autowired ConferenciaFechamentoCaixaRepository conferencias;
    @Autowired FormaPagamentoRepository formas;
    @Autowired CancelamentoVendaService cancelamento;
    EmpresaEntity empresa;
    UsuarioEntity operador;
    UsuarioAutenticado principal;
    CaixaEntity caixa;
    ProdutoEntity produto;
    Long sessao;
    String token;

    @BeforeEach void preparar() {
        empresa = empresa("A");
        operador = usuario(empresa, "02360684663");
        principal = new UsuarioAutenticado(operador.getId(), operador.getCpf(), empresa.getId(), PerfilUsuario.USUARIO);
        token = "Bearer " + jwt.gerarToken(operador);
        caixa = caixa(empresa);
        sessao = sessoesService.abrir(caixa.getId(), new BigDecimal("100"), principal).id();
        var abertura = movimentos.findBySessaoIdAndEmpresaIdOrderByIdAsc(sessao, empresa.getId());
        assertThat(abertura).hasSize(1);
        assertThat(abertura.getFirst().getTipo()).isEqualTo(TipoMovimentacaoCaixa.SUPRIMENTO);
        assertThat(abertura.getFirst().getValor()).isEqualByComparingTo("100");
        assertThat(abertura.getFirst().getObservacao()).isEqualTo("Saldo inicial / Abertura de caixa");
        assertThat(abertura.getFirst().getUsuario().getId()).isEqualTo(operador.getId());
        assertThat(abertura.getFirst().getSessao().getId()).isEqualTo(sessao);
        assertThat(operacional.resumo(sessao, empresa.getId()).saldoEsperadoDinheiro()).isEqualByComparingTo("100");
        produto = new ProdutoEntity(); produto.setEmpresa(empresa); produto.setNome("Produto");
        produto.setUnidadeMedida("UN"); produto.setPrecoVenda(BigDecimal.TEN);
        produto.setControlaEstoque(true); produto.setEstoqueAtual(new BigDecimal("20"));
        produto = produtos.saveAndFlush(produto);
    }

    @Test void saldoInicialZeroNaoCriaMovimentacao() {
        var caixaSemSaldo = caixa(empresa);
        var sessaoSemSaldo = sessoesService.abrir(caixaSemSaldo.getId(), BigDecimal.ZERO, principal).id();

        assertThat(movimentos.findBySessaoIdAndEmpresaIdOrderByIdAsc(sessaoSemSaldo, empresa.getId())).isEmpty();
    }

    @Test void aberturaComSaldoInicialApareceNoHistoricoHttp() throws Exception {
        mvc.perform(get("/financeiro/caixas/sessoes/" + sessao + "/movimentacoes").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].sessaoId").value(sessao))
                .andExpect(jsonPath("$[0].usuarioId").value(operador.getId()))
                .andExpect(jsonPath("$[0].tipo").value("SUPRIMENTO"))
                .andExpect(jsonPath("$[0].valor").value(100))
                .andExpect(jsonPath("$[0].observacao").value("Saldo inicial / Abertura de caixa"))
                .andExpect(jsonPath("$[0].dataHora").exists());
    }

    @AfterEach void limpar() {
        for (String tabela : List.of("conferencias_fechamento_caixa", "movimentacoes_caixa", "pagamentos", "lancamentos_financeiros", "itens_venda",
                "vendas", "movimentacoes_estoque", "produtos", "sessoes_caixa", "caixas", "usuario", "empresas", "formas_pagamento"))
            jdbc.update("delete from " + tabela);
    }

    @ParameterizedTest
    @CsvSource({"DINHEIRO,1,DINHEIRO,110,2", "PIX,2,PIX,100,1",
            "CARTAO_DEBITO,3,DEBITO,100,1", "CARTAO_CREDITO,4,CREDITO,100,1"})
    void vendaCriaUmPagamentoESeparaDinheiroFisicoDosDemaisMeios(FormaPagamento forma, long formaId,
            String tipo, int esperado, int quantidadeMovimentos) throws Exception {
        var outra = sessoesService.abrir(caixa(empresa).getId(), new BigDecimal("500"), principal);
        var pedido = venda(forma, sessao);
        var resposta = vendaService.finalizar(pedido, principal);
        assertThat(resposta.sessaoCaixaId()).isEqualTo(sessao);
        assertThat(vendas.findById(resposta.id()).orElseThrow().getSessaoCaixa().getId()).isEqualTo(sessao);
        var registros = pagamentos.findByEmpresaIdAndVendaIdOrderBySequenciaAsc(empresa.getId(), resposta.id());
        assertThat(registros).hasSize(1);
        var pagamento = registros.getFirst();
        assertThat(pagamento.getStatus()).isEqualTo(StatusPagamento.REGISTRADO);
        assertThat(pagamento.getForma().getId()).isEqualTo(formaId);
        assertThat(pagamento.getFormaPagamento()).isEqualTo(forma);
        assertThat(pagamento.getValor()).isEqualByComparingTo("10");
        assertThat(pagamento.getSequencia()).isEqualTo(1);
        assertThat(pagamento.getUsuario().getId()).isEqualTo(operador.getId());
        assertThat(pagamento.getChaveRequisicao()).isEqualTo(pedido.chaveRequisicao());
        if (forma == FormaPagamento.DINHEIRO) {
            assertThat(pagamento.getValorRecebido()).isEqualByComparingTo("20");
            assertThat(pagamento.getTroco()).isEqualByComparingTo("10");
        } else {
            assertThat(pagamento.getValorRecebido()).isNull();
            assertThat(pagamento.getTroco()).isNull();
        }
        mvc.perform(get("/vendas/" + resposta.id() + "/pagamentos").header("Authorization", token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].formaPagamentoId").value(formaId))
                .andExpect(jsonPath("$[0].tipoFormaPagamento").value(tipo))
                .andExpect(jsonPath("$[0].valor").value(10));
        var fisicos = movimentos.findBySessaoIdAndEmpresaIdOrderByIdAsc(sessao, empresa.getId());
        assertThat(fisicos).hasSize(quantidadeMovimentos);
        if (forma == FormaPagamento.DINHEIRO) {
            var entrada = fisicos.getLast();
            assertThat(entrada.getTipo()).isEqualTo(TipoMovimentacaoCaixa.VENDA);
            assertThat(entrada.getPagamento().getId()).isEqualTo(pagamento.getId());
            assertThat(entrada.getValor()).isEqualByComparingTo("10");
        } else {
            assertThat(fisicos).allSatisfy(m -> {
                assertThat(m.getTipo()).isEqualTo(TipoMovimentacaoCaixa.SUPRIMENTO);
                assertThat(m.getPagamento()).isNull();
            });
        }
        mvc.perform(get("/financeiro/caixas/sessoes/" + sessao + "/resumo").header("Authorization", token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalVendas").value(10))
                .andExpect(jsonPath("$.saldoEsperadoDinheiro").value(esperado))
                .andExpect(jsonPath("$.totaisPorFormaPagamento.length()").value(1))
                .andExpect(jsonPath("$.totaisPorFormaPagamento[0].formaPagamentoId").value(formaId))
                .andExpect(jsonPath("$.totaisPorFormaPagamento[0].tipo").value(tipo))
                .andExpect(jsonPath("$.totaisPorFormaPagamento[0].total").value(10));
        assertThat(operacional.resumo(outra.id(), empresa.getId()).saldoEsperadoDinheiro()).isEqualByComparingTo("500");
        assertThat(operacional.resumo(outra.id(), empresa.getId()).totalVendas()).isZero();
    }

    @ParameterizedTest @CsvSource({"SUPRIMENTO,125,25,0", "SANGRIA,75,0,25"})
    void movimentoManualAfetaSomenteASessaoInformada(TipoMovimentacaoCaixa tipo, int esperado,
            int suprimentos, int sangrias) throws Exception {
        var outra = sessoesService.abrir(caixa(empresa).getId(), new BigDecimal("500"), principal);
        var pedido = manual(tipo, "25");
        var resposta = mvc.perform(post("/financeiro/caixas/sessoes/" + sessao + "/movimentacoes")
                .header("Authorization", token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(pedido)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.sessaoId").value(sessao))
                .andExpect(jsonPath("$.usuarioId").value(operador.getId()))
                .andExpect(jsonPath("$.tipo").value(tipo.name())).andExpect(jsonPath("$.valor").value(25))
                .andReturn();
        var id = json.readTree(resposta.getResponse().getContentAsString()).get("id").asLong();
        var salvo = movimentos.findById(id).orElseThrow();
        assertThat(salvo.getSessao().getId()).isEqualTo(sessao);
        assertThat(salvo.getPagamento()).isNull();
        var resumo = operacional.resumo(sessao, empresa.getId());
        assertThat(resumo.saldoEsperadoDinheiro()).isEqualByComparingTo(Integer.toString(esperado));
        assertThat(resumo.suprimentos()).isEqualByComparingTo(Integer.toString(suprimentos));
        assertThat(resumo.sangrias()).isEqualByComparingTo(Integer.toString(sangrias));
        assertThat(operacional.resumo(outra.id(), empresa.getId()).saldoEsperadoDinheiro()).isEqualByComparingTo("500");
        assertThat(movimentos.findBySessaoIdAndEmpresaIdOrderByIdAsc(outra.id(), empresa.getId())).hasSize(1);
    }

    @Test void sangriaNaoUsaSaldoDeOutraSessaoNemTotaisEletronicos() throws Exception {
        sessoesService.abrir(caixa(empresa).getId(), new BigDecimal("500"), principal);
        for (var forma : List.of(FormaPagamento.PIX, FormaPagamento.CARTAO_DEBITO, FormaPagamento.CARTAO_CREDITO))
            vendaService.finalizar(venda(forma, sessao), principal);
        mvc.perform(post("/financeiro/caixas/sessoes/" + sessao + "/movimentacoes")
                .header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(manual(TipoMovimentacaoCaixa.SANGRIA, "100.01"))))
                .andExpect(status().isConflict()).andExpect(content().string("Saldo em dinheiro insuficiente para sangria."));
        assertThat(movimentos.findBySessaoIdAndEmpresaIdOrderByIdAsc(sessao, empresa.getId())).hasSize(1);
        assertThat(operacional.resumo(sessao, empresa.getId()).saldoEsperadoDinheiro()).isEqualByComparingTo("100");
    }

    @ParameterizedTest @CsvSource({"112.50,2.50", "107.50,-2.50", "110.00,0.00"})
    void fechamentoRegistraOperadorDataESaldoECalculaSobraOuFalta(BigDecimal informado, BigDecimal diferenca) throws Exception {
        vendaService.finalizar(venda(FormaPagamento.DINHEIRO, sessao), principal);
        var colega = usuario(empresa, "22222222222");
        var antes = LocalDateTime.now().minusSeconds(1);
        mvc.perform(post("/financeiro/caixas/" + caixa.getId() + "/sessoes/" + sessao + "/fechar")
                .header("Authorization", "Bearer " + jwt.gerarToken(colega)).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(Map.of("saldoFinal", informado))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("FECHADO"))
                .andExpect(jsonPath("$.usuarioFechamentoId").value(colega.getId()))
                .andExpect(jsonPath("$.dataFechamento").isNotEmpty())
                .andExpect(jsonPath("$.saldoFinal").value(informado.doubleValue()))
                .andExpect(jsonPath("$.resumo.diferenca").value(diferenca.doubleValue()));
        var salva = sessoes.findById(sessao).orElseThrow();
        assertThat(salva.getUsuarioAbertura().getId()).isEqualTo(operador.getId());
        assertThat(salva.getUsuarioFechamento().getId()).isEqualTo(colega.getId());
        assertThat(salva.getDataFechamento()).isBetween(antes, LocalDateTime.now().plusSeconds(1));
        assertThat(salva.getSaldoFinal()).isEqualByComparingTo(informado);
        var resumo = operacional.resumo(sessao, empresa.getId());
        assertThat(resumo.saldoEsperadoDinheiro()).isEqualByComparingTo("110");
        assertThat(resumo.saldoFinalInformado()).isEqualByComparingTo(informado);
        assertThat(resumo.diferenca()).isEqualByComparingTo(diferenca);
    }

    @ParameterizedTest @EnumSource(FormaPagamento.class)
    void cancelamentoEmSessaoAbertaEstornaSomenteDinheiroSemDuplicar(FormaPagamento forma) throws Exception {
        var venda = vendaService.finalizar(venda(forma, sessao), principal);
        var pagamento = pagamentos.findByEmpresaIdAndVendaIdOrderBySequenciaAsc(empresa.getId(), venda.id()).getFirst();
        var originais = movimentos.findBySessaoIdAndEmpresaIdOrderByIdAsc(sessao, empresa.getId());
        for (int tentativa = 0; tentativa < 2; tentativa++)
            mvc.perform(post("/vendas/" + venda.id() + "/cancelar").header("Authorization", token))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELADA"));
        var atuais = movimentos.findBySessaoIdAndEmpresaIdOrderByIdAsc(sessao, empresa.getId());
        assertThat(atuais).extracting(MovimentacaoCaixaEntity::getId)
                .containsAll(originais.stream().map(MovimentacaoCaixaEntity::getId).toList());
        if (forma == FormaPagamento.DINHEIRO) {
            assertThat(atuais).hasSize(3);
            var estorno = atuais.getLast();
            assertThat(estorno.getTipo()).isEqualTo(TipoMovimentacaoCaixa.ESTORNO_VENDA);
            assertThat(estorno.getPagamento().getId()).isEqualTo(pagamento.getId());
            assertThat(estorno.getValor()).isEqualByComparingTo("10");
            assertThat(atuais.get(1).getTipo()).isEqualTo(TipoMovimentacaoCaixa.VENDA);
            assertThat(atuais.get(1).getValor()).isEqualByComparingTo("10");
        } else {
            assertThat(atuais).hasSize(1);
            assertThat(atuais.getFirst().getTipo()).isEqualTo(TipoMovimentacaoCaixa.SUPRIMENTO);
        }
        var registros = pagamentos.findByEmpresaIdAndVendaIdOrderBySequenciaAsc(empresa.getId(), venda.id());
        assertThat(registros).hasSize(1);
        assertThat(registros.getFirst().getStatus()).isEqualTo(StatusPagamento.CANCELADO);
        assertThat(registros.getFirst().getValor()).isEqualByComparingTo("10");
        var resumo = operacional.resumo(sessao, empresa.getId());
        assertThat(resumo.totalVendas()).isZero();
        assertThat(resumo.totaisPorFormaPagamento()).isEmpty();
        assertThat(resumo.saldoEsperadoDinheiro()).isEqualByComparingTo("100");
    }

    @ParameterizedTest @EnumSource(FormaPagamento.class)
    void sessaoFechadaRejeitaCancelamentoDeQualquerMeioSemEfeitoParcial(FormaPagamento forma) throws Exception {
        var venda = vendaService.finalizar(venda(forma, sessao), principal);
        var resumoAntes = operacional.resumo(sessao, empresa.getId());
        sessoesService.fechar(caixa.getId(), sessao, resumoAntes.saldoEsperadoDinheiro(), principal);
        var movimentosAntes = movimentos.findBySessaoIdAndEmpresaIdOrderByIdAsc(sessao, empresa.getId())
                .stream().map(MovimentacaoCaixaEntity::getId).toList();
        mvc.perform(post("/vendas/" + venda.id() + "/cancelar").header("Authorization", token))
                .andExpect(status().isConflict()).andExpect(content().string("Sessão de Caixa fechada."));
        assertThat(vendas.findById(venda.id()).orElseThrow().getStatus()).isEqualTo(StatusVenda.FATURADA);
        assertThat(pagamentos.findByEmpresaIdAndVendaIdOrderBySequenciaAsc(empresa.getId(), venda.id()))
                .singleElement().satisfies(p -> assertThat(p.getStatus()).isEqualTo(StatusPagamento.REGISTRADO));
        assertThat(movimentos.findBySessaoIdAndEmpresaIdOrderByIdAsc(sessao, empresa.getId())
                .stream().map(MovimentacaoCaixaEntity::getId).toList()).isEqualTo(movimentosAntes);
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("19");
        var resumoDepois = operacional.resumo(sessao, empresa.getId());
        assertThat(resumoDepois.totalVendas()).isEqualByComparingTo(resumoAntes.totalVendas());
        assertThat(resumoDepois.totaisPorFormaPagamento()).isEqualTo(resumoAntes.totaisPorFormaPagamento());
        assertThat(resumoDepois.saldoEsperadoDinheiro()).isEqualByComparingTo(resumoAntes.saldoEsperadoDinheiro());
    }

    @Test void cicloCompletoSeparaTotaisDeDinheiroEFechaComDiferenca() throws Exception {
        for (FormaPagamento forma : FormaPagamento.values()) {
            var pedido = venda(forma, null);
            var resposta = vendaService.finalizar(pedido, principal);
            assertThat(resposta.sessaoCaixaId()).isEqualTo(sessao);
            assertThat(vendaService.finalizar(pedido, principal).id()).isEqualTo(resposta.id());
        }
        var suprimento = manual(TipoMovimentacaoCaixa.SUPRIMENTO, "5");
        var sangria = manual(TipoMovimentacaoCaixa.SANGRIA, "3");
        var id = operacional.movimentar(sessao, suprimento, principal).id();
        assertThat(operacional.movimentar(sessao, suprimento, principal).id()).isEqualTo(id);
        operacional.movimentar(sessao, sangria, principal);
        var resumo = operacional.resumo(sessao, empresa.getId());
        assertThat(resumo.totalVendas()).isEqualByComparingTo("40");
        assertThat(resumo.totaisPorFormaPagamento()).hasSize(4).allSatisfy(t -> assertThat(t.total()).isEqualByComparingTo("10"));
        assertThat(resumo.saldoEsperadoDinheiro()).isEqualByComparingTo("112");
        assertThat(movimentos.count()).isEqualTo(4); // saldo inicial + uma venda em dinheiro + duas manuais
        mvc.perform(post("/financeiro/caixas/" + caixa.getId() + "/sessoes/" + sessao + "/fechar")
                .header("Authorization", token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("saldoFinal",111))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.resumo.totalVendas").value(40))
                .andExpect(jsonPath("$.resumo.saldoEsperadoDinheiro").value(112))
                .andExpect(jsonPath("$.resumo.diferenca").value(-1));
        assertThat(sessoesService.fechar(caixa.getId(), sessao, new BigDecimal("111"), principal).resumo().diferenca())
                .isEqualByComparingTo("-1");
        assertThat(operacional.movimentar(sessao, suprimento, principal).id()).isEqualTo(id);
        assertThatThrownBy(() -> operacional.movimentar(sessao, manual(TipoMovimentacaoCaixa.SUPRIMENTO, "1"), principal))
                .hasMessageContaining("fechada");
        assertThatThrownBy(() -> vendaService.finalizar(venda(FormaPagamento.PIX, sessao), principal)).hasMessageContaining("fechada");
    }

    @Test void consultaAbertaIncluiColegaMasExcluiOutraEmpresaEFechadas() throws Exception {
        var b = empresa("B"); var ub = usuario(b, "11144477735");
        sessoes.saveAndFlush(new SessaoCaixaEntity(caixa(b), ub, BigDecimal.ZERO));
        var colega = usuario(empresa, "22222222222");
        var outraSessao = sessoes.saveAndFlush(new SessaoCaixaEntity(caixa(empresa), colega, BigDecimal.ZERO));
        sessoesService.fechar(caixa.getId(), sessao, BigDecimal.ZERO, principal);
        mvc.perform(get("/financeiro/caixas/sessoes/abertas?empresaId=" + b.getId()).header("Authorization", token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].sessaoId").value(outraSessao.getId()))
                .andExpect(jsonPath("$[0].operadorAbertura.id").value(colega.getId()));
    }

    @Test void historicoDeSessoesFechadasRetornaResumoEOperadoresDaEmpresa() throws Exception {
        var fechamento = new BigDecimal("112");
        vendaService.finalizar(venda(FormaPagamento.DINHEIRO, null), principal);
        operacional.movimentar(sessao, manual(TipoMovimentacaoCaixa.SUPRIMENTO, "5"), principal);
        operacional.movimentar(sessao, manual(TipoMovimentacaoCaixa.SANGRIA, "3"), principal);
        sessoesService.fechar(caixa.getId(), sessao, fechamento, principal);

        mvc.perform(get("/financeiro/caixas/sessoes/" + sessao + "/resumo").header("Authorization", token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.descricaoCaixa").value(caixa.getDescricao()))
            .andExpect(jsonPath("$.dataHoraAbertura").exists())
            .andExpect(jsonPath("$.operadorAbertura.id").value(operador.getId()));
        mvc.perform(get("/financeiro/caixas/sessoes/fechadas").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].sessaoId").value(sessao))
                .andExpect(jsonPath("$[0].caixaId").value(caixa.getId()))
                .andExpect(jsonPath("$[0].descricaoCaixa").value(caixa.getDescricao()))
                .andExpect(jsonPath("$[0].operadorAbertura.id").value(operador.getId()))
                .andExpect(jsonPath("$[0].operadorFechamento.id").value(operador.getId()))
                .andExpect(jsonPath("$[0].saldoInicial").value(100))
                .andExpect(jsonPath("$[0].totalVendas").value(10))
                .andExpect(jsonPath("$[0].dinheiroEsperado").value(112))
                .andExpect(jsonPath("$[0].valorInformado").value(112))
                .andExpect(jsonPath("$[0].diferenca").value(0));
    }

    @Test void multiempresaProtegeSessaoMovimentosResumoEFaturamento() throws Exception {
        var b = empresa("B"); var ub = usuario(b, "11144477735");
        var caixaB = caixa(b);
        var sb = sessoes.saveAndFlush(new SessaoCaixaEntity(caixaB, ub, BigDecimal.TEN));
        for (String rota : List.of("/resumo", "/movimentacoes"))
            mvc.perform(get("/financeiro/caixas/sessoes/" + sb.getId() + rota).header("Authorization", token)).andExpect(status().isNotFound());
        for (var tipo : List.of(TipoMovimentacaoCaixa.SUPRIMENTO, TipoMovimentacaoCaixa.SANGRIA))
            mvc.perform(post("/financeiro/caixas/sessoes/" + sb.getId() + "/movimentacoes").header("Authorization", token)
                    .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(manual(tipo, "1"))))
                    .andExpect(status().isNotFound());
        mvc.perform(get("/financeiro/caixas/" + caixaB.getId() + "/sessoes/aberta")
                .header("Authorization", token)).andExpect(status().isNotFound());
        for (var idCaixa : List.of(caixaB.getId(), caixa.getId()))
            mvc.perform(post("/financeiro/caixas/" + idCaixa + "/sessoes/" + sb.getId() + "/fechar")
                    .header("Authorization", token).contentType(MediaType.APPLICATION_JSON).content("{\"saldoFinal\":10}"))
                    .andExpect(status().isNotFound());
        assertThatThrownBy(() -> vendaService.finalizar(venda(FormaPagamento.DINHEIRO, sb.getId()), principal))
                .hasMessageContaining("404");
        assertThat(vendas.count()).isZero();
        var preservada = sessoes.findById(sb.getId()).orElseThrow();
        assertThat(preservada.getStatus()).isEqualTo(StatusSessaoCaixa.ABERTO);
        assertThat(preservada.getSaldoFinal()).isNull();
        assertThat(preservada.getUsuarioFechamento()).isNull();
        assertThat(preservada.getDataFechamento()).isNull();
        assertThat(movimentos.findBySessaoIdAndEmpresaIdOrderByIdAsc(sb.getId(), b.getId())).isEmpty();
        assertThat(operacional.resumo(sb.getId(), b.getId()).saldoEsperadoDinheiro()).isEqualByComparingTo("10");
    }

    @Test void exigeSelecaoQuandoAmbiguaESessaoAbertaParaTodasAsFormas() {
        var s2 = sessoes.saveAndFlush(new SessaoCaixaEntity(caixa(empresa), operador, BigDecimal.ZERO));
        assertThatThrownBy(() -> vendaService.finalizar(venda(FormaPagamento.PIX, null), principal)).hasMessageContaining("sessaoCaixaId");
        assertThat(vendaService.finalizar(venda(FormaPagamento.PIX, s2.getId()), principal).sessaoCaixaId()).isEqualTo(s2.getId());
        sessoesService.fechar(caixa.getId(), sessao, BigDecimal.ZERO, principal);
        sessoesService.fechar(s2.getCaixa().getId(), s2.getId(), BigDecimal.ZERO, principal);
        assertThatThrownBy(() -> vendaService.finalizar(venda(FormaPagamento.PIX, null), principal)).hasMessageContaining("Abra uma");
    }

    @Test void mesmaChaveComOutroConteudoRejeitadaESangriaNaoUltrapassaDinheiro() {
        var pedido = manual(TipoMovimentacaoCaixa.SUPRIMENTO, "5");
        operacional.movimentar(sessao, pedido, principal);
        assertThatThrownBy(() -> operacional.movimentar(sessao, new MovimentacaoCaixaRequestDTO(
                pedido.chaveRequisicao(), pedido.tipo(), BigDecimal.TEN, null), principal)).hasMessageContaining("outros dados");
        assertThatThrownBy(() -> operacional.movimentar(sessao, manual(TipoMovimentacaoCaixa.SANGRIA, "106"), principal))
                .hasMessageContaining("insuficiente");
        assertThat(movimentos.count()).isEqualTo(2);
    }

    @ParameterizedTest @ValueSource(strings = {"-1", "0", "1.001"})
    void rejeitaValorManualInvalido(String valor) throws Exception {
        mvc.perform(post("/financeiro/caixas/sessoes/" + sessao + "/movimentacoes").header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(manual(TipoMovimentacaoCaixa.SUPRIMENTO, valor))))
                .andExpect(status().isBadRequest());
    }

    @Test void exigeJwtENaoPermiteVendaManual() throws Exception {
        mvc.perform(get("/financeiro/caixas/sessoes/abertas")).andExpect(status().isUnauthorized());
        mvc.perform(get("/financeiro/caixas/sessoes/" + sessao + "/resumo")).andExpect(status().isUnauthorized());
        mvc.perform(post("/financeiro/caixas/sessoes/" + sessao + "/movimentacoes")).andExpect(status().isUnauthorized());
        mvc.perform(post("/financeiro/caixas/sessoes/" + sessao + "/movimentacoes").header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(manual(TipoMovimentacaoCaixa.VENDA, "10"))))
                .andExpect(status().isBadRequest());
    }

    @Test void rollbackDepoisDeTodosOsEfeitosNaoDeixaSaldoPagamentoOuVenda() {
        assertThatThrownBy(() -> new TransactionTemplate(transactions).executeWithoutResult(tx -> {
            vendaService.finalizar(venda(FormaPagamento.DINHEIRO, null), principal);
            assertThat(movimentos.count()).isEqualTo(2);
            throw new IllegalStateException("falha depois dos efeitos");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(vendas.count()).isZero(); assertThat(movimentos.count()).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from pagamentos", Long.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from lancamentos_financeiros", Long.class)).isZero();
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("20");
    }

    @Test void estoqueInsuficienteNaoDeixaEfeitosNoCaixa() {
        produto.setEstoqueAtual(BigDecimal.ZERO); produtos.saveAndFlush(produto);
        assertThatThrownBy(() -> vendaService.finalizar(venda(FormaPagamento.DINHEIRO, null), principal)).isInstanceOf(RuntimeException.class);
        assertThat(vendas.count()).isZero(); assertThat(movimentos.count()).isEqualTo(1);
    }

    @Test void retriesConcorrentesDeMovimentoGeramUmaUnicaEntrada() throws Exception {
        var pedido = manual(TipoMovimentacaoCaixa.SUPRIMENTO, "5");
        concorrer(() -> operacional.movimentar(sessao, pedido, principal),
                () -> operacional.movimentar(sessao, pedido, principal));
        assertThat(movimentos.count()).isEqualTo(2);
        assertThat(operacional.resumo(sessao, empresa.getId()).saldoEsperadoDinheiro()).isEqualByComparingTo("105");
    }

    @Test void fechamentoEsperaVendaConcorrenteEIncluiSeuDinheiro() throws Exception {
        concorrer(() -> vendaService.finalizar(venda(FormaPagamento.DINHEIRO, null), principal),
                () -> sessoesService.fechar(caixa.getId(), sessao, new BigDecimal("110"), principal));
        var resumo = operacional.resumo(sessao, empresa.getId());
        assertThat(resumo.status()).isEqualTo(StatusSessaoCaixa.FECHADO);
        assertThat(resumo.saldoEsperadoDinheiro()).isEqualByComparingTo("110");
        assertThat(resumo.diferenca()).isEqualByComparingTo("0");
    }

    @Test void duasSangriasConcorrentesNaoRetiramMaisQueDisponivel() throws Exception {
        var a = manual(TipoMovimentacaoCaixa.SANGRIA, "80");
        var b = manual(TipoMovimentacaoCaixa.SANGRIA, "80");
        assertThatThrownBy(() -> concorrer(() -> operacional.movimentar(sessao, a, principal),
                () -> operacional.movimentar(sessao, b, principal))).hasCauseInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        assertThat(movimentos.count()).isEqualTo(2);
        assertThat(operacional.resumo(sessao, empresa.getId()).saldoEsperadoDinheiro()).isEqualByComparingTo("20");
    }

    @Test void mesmaVendaConcorrenteEReplayAposFecharNaoDuplicamEfeitos() throws Exception {
        var aberta = vendaService.criarVendaAberta(principal);
        vendaService.adicionarItem(aberta.id(), produto.getId(), BigDecimal.ONE, principal);
        var pedido = new FaturamentoVendaDTO(UUID.randomUUID(), BigDecimal.TEN, FormaPagamento.DINHEIRO, BigDecimal.TEN);
        concorrer(() -> vendaService.faturar(aberta.id(), pedido, principal),
                () -> vendaService.faturar(aberta.id(), pedido, principal));
        sessoesService.fechar(caixa.getId(), sessao, new BigDecimal("110"), principal);
        assertThat(vendaService.faturar(aberta.id(), pedido, principal).id()).isEqualTo(aberta.id());
        assertThat(movimentos.count()).isEqualTo(2);
        assertThat(jdbc.queryForObject("select count(*) from pagamentos", Long.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from lancamentos_financeiros", Long.class)).isEqualTo(1);
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("19");
    }

    @Test void fechamentoQueVenceConcorrenciaImpedeVenda() {
        assertThatThrownBy(() -> concorrer(
                () -> sessoesService.fechar(caixa.getId(), sessao, new BigDecimal("100"), principal),
                () -> vendaService.finalizar(venda(FormaPagamento.PIX, sessao), principal)))
                .hasCauseInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        assertThat(vendas.count()).isZero();
        assertThat(movimentos.count()).isEqualTo(1);
    }

    @Test void falhaPosteriorAoMovimentoManualFazRollback() {
        var pedido = manual(TipoMovimentacaoCaixa.SUPRIMENTO, "5");
        assertThatThrownBy(() -> new TransactionTemplate(transactions).executeWithoutResult(tx -> {
            operacional.movimentar(sessao, pedido, principal);
            throw new IllegalStateException("falha");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(movimentos.count()).isEqualTo(1);
        assertThat(operacional.resumo(sessao, empresa.getId()).saldoEsperadoDinheiro()).isEqualByComparingTo("100");
    }


    @Test void fechamentoLegadoMantemDivergenciaSemObservacao() throws Exception {
        mvc.perform(post(urlFechamento()).header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"saldoFinal\":90}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.modalidadeConferencia").value("LEGADA"))
                .andExpect(jsonPath("$.resumo.diferenca").value(-10)).andExpect(jsonPath("$.conferencias").isEmpty());
        var salvo = sessoes.findById(sessao).orElseThrow();
        assertThat(salvo.getModalidadeConferencia()).isEqualTo(ModalidadeConferencia.LEGADA);
        assertThat(salvo.getObservacaoFechamento()).isNull();
        assertThat(conferencias.count()).isZero();
        assertThat(sessoesService.fechar(caixa.getId(), sessao, new BigDecimal("90.00"), principal).dataFechamento())
                .isEqualTo(salvo.getDataFechamento());
        assertThatThrownBy(() -> sessoesService.fechar(caixa.getId(), sessao, new BigDecimal("91"), principal))
                .hasMessageContaining("409");
    }

    @Test void conferenciaCompletaPersisteDinheiroLiquidoETodasAsFormas() throws Exception {
        for (var forma : FormaPagamento.values()) vendaService.finalizar(venda(forma, null), principal);
        operacional.movimentar(sessao, manual(TipoMovimentacaoCaixa.SUPRIMENTO, "5"), principal);
        operacional.movimentar(sessao, manual(TipoMovimentacaoCaixa.SANGRIA, "3"), principal);
        var pedido = conferencia("112", null, informado(2, "10"), informado(3, "10"), informado(4, "10"));
        mvc.perform(post(urlFechamento()).header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(pedido)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.modalidadeConferencia").value("POR_FORMA"))
                .andExpect(jsonPath("$.conferencias.length()").value(4))
                .andExpect(jsonPath("$.conferencias[0].escopo").value("DINHEIRO_FISICO"))
                .andExpect(jsonPath("$.conferencias[0].valorEsperado").value(112))
                .andExpect(jsonPath("$.conferencias[0].valorInformado").value(112))
                .andExpect(jsonPath("$.conferencias[0].diferenca").value(0));
        var salvas = conferencias.findBySessaoIdAndEmpresaIdOrderByIdAsc(sessao, empresa.getId());
        assertThat(salvas).hasSize(4).allSatisfy(l -> {
            assertThat(l.getEmpresa().getId()).isEqualTo(empresa.getId());
            assertThat(l.getDiferenca()).isEqualByComparingTo("0");
        });
    }

    @Test void fechamentoRecalculaEsperadosEIgnoraValoresForjadosNoRequest() throws Exception {
        vendaService.finalizar(venda(FormaPagamento.PIX, null), principal);
        operacional.resumo(sessao, empresa.getId());
        vendaService.finalizar(venda(FormaPagamento.PIX, null), principal);
        operacional.movimentar(sessao, manual(TipoMovimentacaoCaixa.SUPRIMENTO, "5"), principal);
        mvc.perform(post(urlFechamento()).header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"saldoFinal":105,"saldoEsperadoDinheiro":0,
                         "conferencia":{"formas":[{"formaPagamentoId":2,"valorInformado":20,"valorEsperado":0}]}}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.conferencias[0].valorEsperado").value(105))
                .andExpect(jsonPath("$.conferencias[1].valorEsperado").value(20))
                .andExpect(jsonPath("$.conferencias[1].diferenca").value(0));
        var salvas = conferencias.findBySessaoIdAndEmpresaIdOrderByIdAsc(sessao, empresa.getId());
        assertThat(salvas.getFirst().getValorEsperado()).isEqualByComparingTo("105");
        assertThat(salvas.getLast().getValorEsperado()).isEqualByComparingTo("20");
    }

    @Test void nenhumaVendaExigeSomenteConferenciaDoDinheiro() {
        var resposta = sessoesService.fechar(caixa.getId(), sessao, conferencia("100", null), principal);
        assertThat(resposta.conferencias()).hasSize(1);
        assertThat(resposta.conferencias().getFirst().formaPagamentoId()).isNull();
    }

    @Test void divergenciasNaoSeCompensamEExigemObservacao() throws Exception {
        vendaService.finalizar(venda(FormaPagamento.PIX, null), principal);
        var pedido = conferencia("99", "  ", informado(2, "11"));
        mvc.perform(post(urlFechamento()).header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(pedido))).andExpect(status().isConflict());
        assertThat(conferencias.count()).isZero();
        assertThat(sessoes.findById(sessao).orElseThrow().getStatus()).isEqualTo(StatusSessaoCaixa.ABERTO);
        var resposta = sessoesService.fechar(caixa.getId(), sessao,
                conferencia("99", "  Falta em dinheiro e sobra no PIX  ", informado(2, "11")), principal);
        assertThat(resposta.observacaoFechamento()).isEqualTo("Falta em dinheiro e sobra no PIX");
        assertThat(resposta.conferencias().getFirst().diferenca()).isEqualByComparingTo("-1");
        assertThat(resposta.conferencias().getLast().diferenca()).isEqualByComparingTo("1");
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "[]",
        "[{\"formaPagamentoId\":2,\"valorInformado\":10},{\"formaPagamentoId\":2,\"valorInformado\":10}]",
        "[{\"formaPagamentoId\":2,\"valorInformado\":10},{\"formaPagamentoId\":3,\"valorInformado\":0}]",
        "[{\"formaPagamentoId\":999999,\"valorInformado\":10}]",
        "[{\"formaPagamentoId\":1,\"valorInformado\":10}]",
        "[{\"formaPagamentoId\":2,\"valorInformado\":-1}]",
        "[{\"formaPagamentoId\":2,\"valorInformado\":1.001}]",
        "[{\"formaPagamentoId\":2,\"valorInformado\":100000000000000000}]",
        "[{\"formaPagamentoId\":2}]", "[null]", "null"
    })
    void rejeitaConferenciaInvalidaSemFecharOuPersistir(String formasJson) throws Exception {
        vendaService.finalizar(venda(FormaPagamento.PIX, null), principal);
        mvc.perform(post(urlFechamento()).header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"saldoFinal\":100,\"conferencia\":{\"formas\":" + formasJson + "}}"))
                .andExpect(status().isBadRequest());
        assertThat(conferencias.count()).isZero();
        var aberta = sessoes.findById(sessao).orElseThrow();
        assertThat(aberta.getStatus()).isEqualTo(StatusSessaoCaixa.ABERTO);
        assertThat(aberta.getModalidadeConferencia()).isNull();
    }

    @Test void retryEquivalentePreservaSnapshotMesmoAposRenomearEInativarForma() {
        vendaService.finalizar(venda(FormaPagamento.PIX, null), principal);
        vendaService.finalizar(venda(FormaPagamento.CARTAO_DEBITO, null), principal);
        var primeira = sessoesService.fechar(caixa.getId(), sessao,
                conferencia("100", "Conferido", informado(2, "10"), informado(3, "10")), principal);
        var ids = conferencias.findAll().stream().map(ConferenciaFechamentoCaixaEntity::getId).toList();
        var pix = formas.findById(2L).orElseThrow();
        pix.atualizar("PIX renomeado", false); formas.saveAndFlush(pix);
        var segunda = sessoesService.fechar(caixa.getId(), sessao,
                conferencia("100.00", " Conferido ", informado(3, "10.00"), informado(2, "10.0")), principal);
        assertThat(segunda.conferencias()).isEqualTo(primeira.conferencias());
        assertThat(segunda.dataFechamento()).isEqualTo(primeira.dataFechamento());
        assertThat(segunda.usuarioFechamentoId()).isEqualTo(primeira.usuarioFechamentoId());
        assertThat(conferencias.findAll().stream().map(ConferenciaFechamentoCaixaEntity::getId).toList()).isEqualTo(ids);
    }

    @Test void retryDiferenteNaoSobrescreveConferencia() throws Exception {
        vendaService.finalizar(venda(FormaPagamento.PIX, null), principal);
        var pedido = conferencia("100", null, informado(2, "10"));
        sessoesService.fechar(caixa.getId(), sessao, pedido, principal);
        for (var alterado : List.of(
                conferencia("101", null, informado(2, "10")),
                conferencia("100", null, informado(2, "11")),
                conferencia("100", "Outra observacao", informado(2, "10")),
                conferencia("100", null),
                new FechamentoCaixaDTO(new BigDecimal("100")))) {
            mvc.perform(post(urlFechamento()).header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsBytes(alterado))).andExpect(status().isConflict());
        }
        assertThat(conferencias.count()).isEqualTo(2);
        assertThat(sessoesService.fechar(caixa.getId(), sessao, pedido, principal).observacaoFechamento()).isNull();
    }

    @Test void fechamentoLegadoNaoPodeSerConvertidoEmConferencia() {
        sessoesService.fechar(caixa.getId(), sessao, new BigDecimal("100"), principal);
        assertThatThrownBy(() -> sessoesService.fechar(caixa.getId(), sessao, conferencia("100", null), principal))
                .hasMessageContaining("409");
        assertThat(conferencias.count()).isZero();
    }

    @Test void outraEmpresaNaoFechaNemReexecutaConferencia() throws Exception {
        var b = empresa("B"); var ub = usuario(b, "11144477735");
        String tokenB = "Bearer " + jwt.gerarToken(ub);
        var pedido = conferencia("100", null);
        for (boolean fecharPrimeiro : List.of(false, true)) {
            if (fecharPrimeiro) sessoesService.fechar(caixa.getId(), sessao, pedido, principal);
            mvc.perform(post(urlFechamento()).header("Authorization", tokenB).contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsBytes(pedido))).andExpect(status().isNotFound());
        }
        assertThat(conferencias.findBySessaoIdAndEmpresaIdOrderByIdAsc(sessao, b.getId())).isEmpty();
        assertThat(conferencias.count()).isEqualTo(1);
    }

    @Test void rollbackDoFechamentoRemoveConferenciaEMantemSessaoAberta() {
        assertThatThrownBy(() -> new TransactionTemplate(transactions).executeWithoutResult(tx -> {
            sessoesService.fechar(caixa.getId(), sessao, conferencia("100", null), principal);
            throw new IllegalStateException("falha posterior");
        })).hasMessageContaining("falha posterior");
        assertThat(conferencias.count()).isZero();
        assertThat(sessoes.findById(sessao).orElseThrow().getStatus()).isEqualTo(StatusSessaoCaixa.ABERTO);
    }

    @Test void retriesConcorrentesDeConferenciaPersistemUmaVez() throws Exception {
        var pedido = conferencia("100", null);
        concorrer(() -> sessoesService.fechar(caixa.getId(), sessao, pedido, principal),
                () -> sessoesService.fechar(caixa.getId(), sessao, pedido, principal));
        assertThat(conferencias.count()).isEqualTo(1);
    }

    @ParameterizedTest @ValueSource(strings = {"DINHEIRO", "PIX", "CARTAO_DEBITO", "CARTAO_CREDITO"})
    void conferenciaPreservaBloqueioDoCancelamentoEmSessaoFechada(String codigo) {
        var forma = FormaPagamento.valueOf(codigo);
        var venda = vendaService.finalizar(venda(forma, null), principal);
        var pedido = forma == FormaPagamento.DINHEIRO ? conferencia("110", null)
                : conferencia("100", null, informado(forma.idPadrao(), "10"));
        sessoesService.fechar(caixa.getId(), sessao, pedido, principal);
        assertThatThrownBy(() -> cancelamento.cancelarVendaFaturada(venda.id(), principal)).hasMessageContaining("fechada");
        assertThat(vendas.findById(venda.id()).orElseThrow().getStatus()).isEqualTo(StatusVenda.FATURADA);
        assertThat(produtos.findById(produto.getId()).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("19");
    }

    private String urlFechamento() { return "/financeiro/caixas/" + caixa.getId() + "/sessoes/" + sessao + "/fechar"; }
    @Test void separaFormasDoMesmoTipoEConsolidaSomenteDinheiroFisico() {
        var pix = formas.saveAndFlush(new FormaPagamentoEntity("PIX loja", TipoFormaPagamento.PIX, true));
        var dinheiro = formas.saveAndFlush(new FormaPagamentoEntity("Dinheiro balcao", TipoFormaPagamento.DINHEIRO, true));
        vendaService.finalizar(venda(FormaPagamento.PIX, null), principal);
        vendaService.finalizar(venda(FormaPagamento.DINHEIRO, null), principal);
        for (var forma : List.of(pix, dinheiro)) {
            var base = venda(FormaPagamento.PIX, null);
            vendaService.finalizar(new VendaRequestDTO(base.chaveRequisicao(), base.itens(), base.clienteId(),
                    base.desconto(), base.totalEsperado(), null, base.valorRecebido(), null, null, forma.getId(), sessao), principal);
        }
        pix.atualizar(pix.getDescricao(), false); formas.saveAndFlush(pix);
        var resposta = sessoesService.fechar(caixa.getId(), sessao,
                conferencia("120", null, informado(2, "10"), informado(pix.getId(), "10")), principal);
        assertThat(resposta.conferencias()).hasSize(3);
        assertThat(resposta.conferencias().getFirst().valorEsperado()).isEqualByComparingTo("120");
        assertThat(resposta.conferencias()).filteredOn(c -> c.escopo() == EscopoConferenciaCaixa.FORMA_PAGAMENTO)
                .extracting(ConferenciaFechamentoCaixaDTO::formaPagamentoId).containsExactlyInAnyOrder(2L, pix.getId());
    }

    @Test void cancelamentosAnterioresNaoEntramNosEsperados() {
        for (var forma : List.of(FormaPagamento.DINHEIRO, FormaPagamento.PIX)) {
            var venda = vendaService.finalizar(venda(forma, null), principal);
            cancelamento.cancelarVendaFaturada(venda.id(), principal);
        }
        var resposta = sessoesService.fechar(caixa.getId(), sessao, conferencia("100", null), principal);
        assertThat(resposta.conferencias()).hasSize(1);
        assertThat(resposta.conferencias().getFirst().valorEsperado()).isEqualByComparingTo("100");
        assertThat(resposta.resumo().totalVendas()).isEqualByComparingTo("0");
    }

    private FechamentoCaixaDTO conferencia(String dinheiro, String observacao, FechamentoCaixaDTO.Forma... formas) {
        return new FechamentoCaixaDTO(new BigDecimal(dinheiro), new FechamentoCaixaDTO.Conferencia(List.of(formas), observacao));
    }
    private FechamentoCaixaDTO.Forma informado(long id, String valor) {
        return new FechamentoCaixaDTO.Forma(id, new BigDecimal(valor));
    }
    private void concorrer(Callable<?> primeira, Callable<?> segunda) throws Exception {
        var gravou = new CountDownLatch(1); var liberar = new CountDownLatch(1); var iniciou = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var a = pool.submit(() -> new TransactionTemplate(transactions).execute(tx -> {
                try { var r = primeira.call(); gravou.countDown();
                    if (!liberar.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("timeout"); return r;
                } catch (Exception e) { throw new IllegalStateException(e); }
            }));
            try {
                assertThat(gravou.await(10, TimeUnit.SECONDS)).isTrue();
                var b = pool.submit(() -> { iniciou.countDown(); return segunda.call(); });
                assertThat(iniciou.await(5, TimeUnit.SECONDS)).isTrue();
                assertThatThrownBy(() -> b.get(200, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
                liberar.countDown(); a.get(10, TimeUnit.SECONDS); b.get(10, TimeUnit.SECONDS);
            } finally { liberar.countDown(); }
        }
    }

    private VendaRequestDTO venda(FormaPagamento forma, Long sessaoId) {
        return new VendaRequestDTO(UUID.randomUUID(), List.of(new VendaRequestDTO.Item(produto.getId(), BigDecimal.ONE, BigDecimal.TEN)),
                null, BigDecimal.ZERO, BigDecimal.TEN, forma, forma == FormaPagamento.DINHEIRO ? new BigDecimal("20") : BigDecimal.TEN,
                null, null, null, sessaoId);
    }
    private MovimentacaoCaixaRequestDTO manual(TipoMovimentacaoCaixa tipo, String valor) {
        return new MovimentacaoCaixaRequestDTO(UUID.randomUUID(), tipo, new BigDecimal(valor), null);
    }
    private EmpresaEntity empresa(String nome) {
        var e = new EmpresaEntity(); e.setRazaoSocial(nome); e.setAtivo(true); return empresas.saveAndFlush(e);
    }
    private UsuarioEntity usuario(EmpresaEntity e, String cpf) {
        var u = new UsuarioEntity(); u.setEmpresa(e); u.setCpf(cpf); u.setNomeUsuario("Operador");
        u.setSenha("hash"); u.setAtivo(true); u.setPerfil(PerfilUsuario.USUARIO); return usuarios.saveAndFlush(u);
    }
    private CaixaEntity caixa(EmpresaEntity e) {
        var c = new CaixaEntity(); c.setEmpresa(e); c.setDescricao("Caixa " + UUID.randomUUID()); return caixas.saveAndFlush(c);
    }
}
