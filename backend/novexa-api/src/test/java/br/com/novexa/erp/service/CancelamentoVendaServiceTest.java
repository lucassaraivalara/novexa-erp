package br.com.novexa.erp.service;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.*;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@DataJpaTest(showSql = false, properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false"
})
@Import({CancelamentoVendaService.class, MovimentacaoEstoqueService.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class CancelamentoVendaServiceTest {
    @Autowired CancelamentoVendaService service;
    @org.springframework.test.context.bean.override.mockito.MockitoBean PagamentoService pagamentos;
    @Autowired MovimentacaoEstoqueService estoque;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired ProdutoRepository produtos;
    @Autowired VendaRepository vendas;
    @Autowired ItemVendaRepository itens;
    @MockitoSpyBean MovimentacaoEstoqueRepository movimentos;
    @Autowired PlatformTransactionManager transactions;
    EmpresaEntity empresa;
    UsuarioEntity operador, colega;
    ProdutoEntity produto, segundo, semControle;
    UsuarioAutenticado principal;
    Long vendaId;

    @BeforeEach void preparar() {
        empresa = empresa("A");
        operador = usuario(empresa, "11111111111");
        colega = usuario(empresa, "22222222222");
        principal = principal(operador);
        produto = produto("A", true); segundo = produto("B", true); semControle = produto("Serviço", false);
        vendaId = new TransactionTemplate(transactions).execute(tx -> {
            var venda = vendas.save(new VendaEntity(operador, null));
            adicionar(venda, produto, "2.500", 0, true);
            adicionar(venda, segundo, "1", 1, true);
            adicionar(venda, semControle, "1", 2, false);
            venda.setSubtotal(new BigDecimal("45")); venda.setDesconto(BigDecimal.ZERO); venda.setTotal(new BigDecimal("45"));
            venda.setStatus(StatusVenda.FATURADA);
            vendas.saveAndFlush(venda);
            return venda.getId();
        });
    }

    @AfterEach void limpar() {
        reset(movimentos);
        itens.deleteAllInBatch(); vendas.deleteAllInBatch(); movimentos.deleteAllInBatch();
        produtos.deleteAllInBatch(); usuarios.deleteAllInBatch(); empresas.deleteAllInBatch();
    }

    @Test void reverteSaidasIntegraisPreservandoItensEHistorico() {
        estoque.movimentar(empresa.getId(), produto.getId(), operador.getId(), TipoMovimentacaoEstoque.ENTRADA,
                OrigemMovimentacaoEstoque.MANUAL, new BigDecimal("3"), "entrada posterior");
        var idsOriginais = movimentos.findAll().stream().map(MovimentacaoEstoqueEntity::getId).toList();
        var resposta = service.cancelarVendaFaturada(vendaId, principal);
        assertThat(resposta.status()).isEqualTo(StatusVenda.CANCELADA);
        assertThat(resposta.itens()).hasSize(3);
        assertThat(resposta.total()).isEqualByComparingTo("45");
        assertThat(saldo(produto)).isEqualByComparingTo("13");
        assertThat(saldo(segundo)).isEqualByComparingTo("10");
        assertThat(saldo(semControle)).isEqualByComparingTo("10");
        var reversoes = reversoes();
        assertThat(reversoes).hasSize(2).allSatisfy(m -> {
            assertThat(m.getTipo()).isEqualTo(TipoMovimentacaoEstoque.ENTRADA);
            assertThat(m.getUsuario().getId()).isEqualTo(operador.getId());
            assertThat(m.getMotivo()).contains("venda " + vendaId, "movimentação ");
            assertThat(m.getSaldoPosterior().subtract(m.getSaldoAnterior())).isEqualByComparingTo(m.getQuantidade());
        });
        assertThat(reversoes.stream().filter(m -> m.getProduto().getId().equals(produto.getId())).findFirst().orElseThrow().getSaldoAnterior())
                .isEqualByComparingTo("10.5");
        assertThat(movimentos.findAll().stream().map(MovimentacaoEstoqueEntity::getId)).containsAll(idsOriginais);
        assertThat(itens.findByVendaId(vendaId)).hasSize(3).allSatisfy(i -> {
            assertThat(i.getPrecoUnitario()).isEqualByComparingTo("10");
            assertThat(i.getNomeProduto()).isNotBlank();
        });
    }

    @Test void retryNaoDuplicaReversao() {
        var primeira = service.cancelarVendaFaturada(vendaId, principal);
        var segunda = service.cancelarVendaFaturada(vendaId, principal);
        assertThat(segunda).isEqualTo(primeira);
        assertThat(reversoes()).hasSize(2);
        assertThat(saldo(produto)).isEqualByComparingTo("10");
    }

    @Test void abertaNaoPodeSerCancelada() {
        new TransactionTemplate(transactions).executeWithoutResult(tx -> {
            var v = vendas.findById(vendaId).orElseThrow(); v.setStatus(StatusVenda.ABERTA); vendas.saveAndFlush(v);
        });
        assertThatThrownBy(() -> service.cancelarVendaFaturada(vendaId, principal)).hasMessageContaining("FATURADA");
        assertThat(reversoes()).isEmpty(); assertThat(saldo(produto)).isEqualByComparingTo("7.5");
    }

    @Test void outraEmpresaNaoCancelaNemReverte() {
        var outra = empresa("B"); var outro = usuario(outra, "33333333333");
        assertThatThrownBy(() -> service.cancelarVendaFaturada(vendaId, principal(outro))).hasMessageContaining("404");
        assertThatThrownBy(() -> service.cancelarVendaFaturada(vendaId,
                new UsuarioAutenticado(outro.getId(), outro.getCpf(), empresa.getId(), PerfilUsuario.USUARIO)))
                .hasMessageContaining("403");
        assertThat(reversoes()).isEmpty();
        assertThat(vendas.findById(vendaId).orElseThrow().getStatus()).isEqualTo(StatusVenda.FATURADA);
    }

    @Test void reverteBaixaMesmoComProdutoInativoESemControleAtual() {
        produto.setEstoqueAtual(saldo(produto)); produto.setAtivo(false); produto.setControlaEstoque(false);
        produtos.saveAndFlush(produto);
        semControle.setControlaEstoque(true); produtos.saveAndFlush(semControle);
        service.cancelarVendaFaturada(vendaId, principal);
        assertThat(saldo(produto)).isEqualByComparingTo("10");
        assertThat(saldo(semControle)).isEqualByComparingTo("10");
        assertThat(produtos.findById(produto.getId()).orElseThrow().getControlaEstoque()).isFalse();
        assertThat(reversoes()).hasSize(2);
    }

    @Test void falhaNaSegundaReversaoReverteTudoInclusivePrimeiroSaldoEStatus() {
        var contador = new AtomicInteger();
        doAnswer(inv -> {
            MovimentacaoEstoqueEntity m = inv.getArgument(0);
            var salvo = movimentos.saveAndFlush(m);
            if (m.getOrigem() == OrigemMovimentacaoEstoque.CANCELAMENTO && contador.incrementAndGet() == 2)
                throw new IllegalStateException("falha após segunda reversão");
            return salvo;
        }).when(movimentos).save(any(MovimentacaoEstoqueEntity.class));
        assertThatThrownBy(() -> service.cancelarVendaFaturada(vendaId, principal)).hasMessageContaining("falha");
        assertThat(reversoes()).isEmpty();
        assertThat(saldo(produto)).isEqualByComparingTo("7.5");
        assertThat(saldo(segundo)).isEqualByComparingTo("9");
        assertThat(vendas.findById(vendaId).orElseThrow().getStatus()).isEqualTo(StatusVenda.FATURADA);
        reset(movimentos);
        service.cancelarVendaFaturada(vendaId, principal);
        assertThat(reversoes()).hasSize(2);
    }

    @Test void excecaoDoFuturoOrquestradorTambemDesfazNucleo() {
        assertThatThrownBy(() -> new TransactionTemplate(transactions).executeWithoutResult(tx -> {
            service.cancelarVendaFaturada(vendaId, principal);
            throw new IllegalStateException("falha da próxima etapa");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(reversoes()).isEmpty();
        assertThat(vendas.findById(vendaId).orElseThrow().getStatus()).isEqualTo(StatusVenda.FATURADA);
        assertThat(saldo(produto)).isEqualByComparingTo("7.5");
    }

    @Test void cancelamentosConcorrentesPorOperadoresDiferentesRevertemUmaVez() throws Exception {
        var gravou = new CountDownLatch(1); var liberar = new CountDownLatch(1); var iniciou = new CountDownLatch(1);
        try(var pool = Executors.newFixedThreadPool(2)) {
            var a = pool.submit(() -> new TransactionTemplate(transactions).execute(tx -> {
                var r = service.cancelarVendaFaturada(vendaId, principal);
                gravou.countDown();
                try { if (!liberar.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("timeout"); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); }
                return r;
            }));
            try {
                assertThat(gravou.await(10, TimeUnit.SECONDS)).isTrue();
                var b = pool.submit(() -> { iniciou.countDown(); return service.cancelarVendaFaturada(vendaId, principal(colega)); });
                assertThat(iniciou.await(5, TimeUnit.SECONDS)).isTrue();
                assertThatThrownBy(() -> b.get(200, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
                liberar.countDown();
                assertThat(a.get(10, TimeUnit.SECONDS).status()).isEqualTo(StatusVenda.CANCELADA);
                assertThat(b.get(10, TimeUnit.SECONDS).status()).isEqualTo(StatusVenda.CANCELADA);
            } finally { liberar.countDown(); }
        }
        assertThat(reversoes()).hasSize(2);
        assertThat(saldo(produto)).isEqualByComparingTo("10");
        assertThat(saldo(segundo)).isEqualByComparingTo("10");
    }

    @Test void historicoIncompativelBloqueiaCancelamentoSemEfeitoParcial() {
        new TransactionTemplate(transactions).executeWithoutResult(tx -> {
            var item = itens.findByVendaId(vendaId).stream().filter(i -> i.getProduto().getId().equals(segundo.getId())).findFirst().orElseThrow();
            item.setQuantidade(new BigDecimal("9")); itens.saveAndFlush(item);
        });
        assertThatThrownBy(() -> service.cancelarVendaFaturada(vendaId, principal)).hasMessageContaining("incompatível");
        assertThat(reversoes()).isEmpty();
        assertThat(saldo(produto)).isEqualByComparingTo("7.5");
        assertThat(vendas.findById(vendaId).orElseThrow().getStatus()).isEqualTo(StatusVenda.FATURADA);
    }

    private List<MovimentacaoEstoqueEntity> reversoes() {
        return movimentos.findAll().stream().filter(m -> m.getOrigem() == OrigemMovimentacaoEstoque.CANCELAMENTO).toList();
    }
    private BigDecimal saldo(ProdutoEntity p) { return produtos.findById(p.getId()).orElseThrow().getEstoqueAtual(); }
    private void adicionar(VendaEntity venda, ProdutoEntity p, String quantidade, int ordem, boolean baixar) {
        var q = new BigDecimal(quantidade);
        Long movimentoId = baixar ? estoque.movimentar(empresa.getId(), p.getId(), operador.getId(),
                TipoMovimentacaoEstoque.SAIDA, OrigemMovimentacaoEstoque.VENDA, q, "Venda " + venda.getId()).getId() : null;
        itens.saveAndFlush(new ItemVendaEntity(venda, p, q, BigDecimal.TEN, q.multiply(BigDecimal.TEN), movimentoId, ordem));
    }
    private UsuarioAutenticado principal(UsuarioEntity u) {
        return new UsuarioAutenticado(u.getId(), u.getCpf(), u.getEmpresa().getId(), PerfilUsuario.USUARIO);
    }
    private EmpresaEntity empresa(String nome) {
        var e = new EmpresaEntity(); e.setRazaoSocial(nome); e.setAtivo(true); return empresas.saveAndFlush(e);
    }
    private UsuarioEntity usuario(EmpresaEntity e, String cpf) {
        var u = new UsuarioEntity(); u.setEmpresa(e); u.setCpf(cpf); u.setNomeUsuario("Operador");
        u.setSenha("hash"); u.setAtivo(true); u.setPerfil(PerfilUsuario.USUARIO); return usuarios.saveAndFlush(u);
    }
    private ProdutoEntity produto(String nome, boolean controla) {
        var p = new ProdutoEntity(); p.setEmpresa(empresa); p.setNome(nome); p.setUnidadeMedida("UN");
        p.setPrecoVenda(BigDecimal.TEN); p.setEstoqueAtual(BigDecimal.TEN); p.setControlaEstoque(controla); p.setAtivo(true);
        return produtos.saveAndFlush(p);
    }
}
