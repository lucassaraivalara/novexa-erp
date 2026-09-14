package br.com.novexa.erp.service;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.exception.EstoqueInsuficienteException;
import br.com.novexa.erp.repository.*;
import jakarta.persistence.EntityManager;
import org.hibernate.resource.jdbc.spi.StatementInspector;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;

// Cada worker usa uma conexao/transacao independente; fixtures sao commitadas antes da corrida.
@DataJpaTest(showSql = false, properties = {
        "spring.datasource.url=jdbc:h2:mem:estoque-concorrencia;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({MovimentacaoEstoqueService.class, ProdutoService.class, EmpresaService.class,
        EstoqueConcorrenciaTest.SqlConfig.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class EstoqueConcorrenciaTest {

    @Autowired MovimentacaoEstoqueService estoque;
    @MockitoSpyBean ProdutoService cadastro;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired ProdutoRepository produtos;
    @MockitoSpyBean MovimentacaoEstoqueRepository movimentos;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired EntityManager entityManager;
    @Autowired SqlProbe sqlProbe;

    private Long empresaId;
    private Long usuarioId;
    private Long produtoId;

    @BeforeEach
    void preparar() {
        sqlProbe.observar = sql -> {};
        transacao().executeWithoutResult(status -> {
            movimentos.deleteAllInBatch();
            produtos.deleteAllInBatch();
            usuarios.deleteAllInBatch();
            empresas.deleteAllInBatch();
            var empresa = new EmpresaEntity();
            empresa.setRazaoSocial("Empresa concorrencia");
            empresa.setCnpj("11222333000199");
            empresas.saveAndFlush(empresa);
            empresaId = empresa.getId();
            var usuario = new UsuarioEntity();
            usuario.setEmpresa(empresa);
            usuario.setNomeUsuario("Operador");
            usuario.setCpf("12345678901");
            usuario.setSenha("hash-teste");
            usuario.setPerfil(PerfilUsuario.USUARIO);
            usuarios.saveAndFlush(usuario);
            usuarioId = usuario.getId();
            var produto = dadosCadastrais();
            produto.setNome("Produto original");
            produto.setEmpresa(empresa);
            produto.setEstoqueAtual(new BigDecimal("10"));
            produtoId = produtos.saveAndFlush(produto).getId();
        });
    }

    @ParameterizedTest
    @CsvSource({
            "ENTRADA,5,ENTRADA,3,18", "ENTRADA,3,ENTRADA,5,18",
            "ENTRADA,5,SAIDA,2,13", "SAIDA,2,ENTRADA,5,13",
            "AJUSTE,8,ENTRADA,5,13", "ENTRADA,5,AJUSTE,8,8",
            "AJUSTE,8,SAIDA,2,6", "SAIDA,2,AJUSTE,8,8"
    })
    void movimentacoesConcorrentesMantemHistoricoSerializavel(
            TipoMovimentacaoEstoque primeiroTipo, String primeiraQuantidade,
            TipoMovimentacaoEstoque segundoTipo, String segundaQuantidade, String saldoFinal) throws Exception {
        executarComDisputa(primeiroTipo, primeiraQuantidade, segundoTipo, segundaQuantidade, false);
        var historico = movimentos.findAll().stream()
                .sorted(Comparator.comparing(MovimentacaoEstoqueEntity::getId)).toList();
        assertThat(historico).hasSize(2);
        var primeiro = historico.get(0);
        var segundo = historico.get(1);
        assertThat(primeiro.getTipo()).isEqualTo(primeiroTipo);
        assertThat(primeiro.getQuantidade()).isEqualByComparingTo(primeiraQuantidade);
        assertThat(primeiro.getSaldoAnterior()).isEqualByComparingTo("10");
        BigDecimal saldoIntermediario = switch (primeiroTipo) {
            case ENTRADA -> BigDecimal.TEN.add(new BigDecimal(primeiraQuantidade));
            case SAIDA -> BigDecimal.TEN.subtract(new BigDecimal(primeiraQuantidade));
            case AJUSTE -> new BigDecimal(primeiraQuantidade);
        };
        assertThat(primeiro.getSaldoPosterior()).isEqualByComparingTo(saldoIntermediario);
        assertThat(segundo.getTipo()).isEqualTo(segundoTipo);
        assertThat(segundo.getQuantidade()).isEqualByComparingTo(segundaQuantidade);
        assertThat(segundo.getSaldoAnterior()).isEqualByComparingTo(primeiro.getSaldoPosterior());
        assertThat(segundo.getSaldoPosterior()).isEqualByComparingTo(saldoFinal);
        assertThat(segundo.getDataHora()).isAfterOrEqualTo(primeiro.getDataHora());
        assertThat(produtos.findById(produtoId).orElseThrow().getEstoqueAtual()).isEqualByComparingTo(saldoFinal);
    }

    @Test
    void duasSaidasDeDoisComSaldoDoisPermitemSomenteUma() throws Exception {
        transacao().executeWithoutResult(status -> {
            produtos.findById(produtoId).orElseThrow().setEstoqueAtual(new BigDecimal("2"));
        });
        executarComDisputa(TipoMovimentacaoEstoque.SAIDA, "2", TipoMovimentacaoEstoque.SAIDA, "2", true);
        assertThat(produtos.findById(produtoId).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("0");
        assertThat(movimentos.findAll()).singleElement().satisfies(movimento -> {
            assertThat(movimento.getQuantidade()).isEqualByComparingTo("2");
            assertThat(movimento.getSaldoAnterior()).isEqualByComparingTo("2");
            assertThat(movimento.getSaldoPosterior()).isEqualByComparingTo("0");
        });
    }

    private void executarComDisputa(TipoMovimentacaoEstoque primeiroTipo, String primeiraQuantidade,
                                    TipoMovimentacaoEstoque segundoTipo, String segundaQuantidade,
                                    boolean segundaRejeitada) throws Exception {
        var primeiroTemLock = new CountDownLatch(1);
        var liberarPrimeiro = new CountDownLatch(1);
        var segundoChegouAoLock = new CountDownLatch(1);
        var segundoThread = new AtomicReference<Thread>();
        sqlProbe.observar = sql -> {
            if (Thread.currentThread() == segundoThread.get() && sql.contains("for update")) {
                segundoChegouAoLock.countDown();
            }
        };

        try (var workers = Executors.newFixedThreadPool(2)) {
            Future<?> primeiro = workers.submit(() -> transacao().executeWithoutResult(status -> {
                movimentar(primeiroTipo, primeiraQuantidade);
                entityManager.flush();
                primeiroTemLock.countDown();
                aguardar(liberarPrimeiro);
            }));
            Future<?> segundo;
            try {
                aguardar(primeiroTemLock);
                segundo = workers.submit(() -> {
                    segundoThread.set(Thread.currentThread());
                    return movimentar(segundoTipo, segundaQuantidade);
                });
                aguardar(segundoChegouAoLock);
                // B chegou a preparacao do SELECT FOR UPDATE e deve aguardar o commit de A.
                assertThatThrownBy(() -> segundo.get(200, TimeUnit.MILLISECONDS))
                        .isInstanceOf(TimeoutException.class);
            } finally {
                liberarPrimeiro.countDown();
                primeiro.get(10, TimeUnit.SECONDS);
            }
            if (segundaRejeitada) {
                assertThatThrownBy(() -> segundo.get(10, TimeUnit.SECONDS))
                        .isInstanceOf(ExecutionException.class)
                        .hasCauseInstanceOf(EstoqueInsuficienteException.class);
            } else {
                segundo.get(10, TimeUnit.SECONDS);
            }
        }
    }

    @Test
    void produtosDiferentesNaoCompartilhamLock() throws Exception {
        Long outroId = transacao().execute(status -> {
            var outro = dadosCadastrais();
            outro.setEmpresa(empresas.findById(empresaId).orElseThrow());
            return produtos.saveAndFlush(outro).getId();
        });
        var primeiroTemLock = new CountDownLatch(1);
        var liberarPrimeiro = new CountDownLatch(1);
        try (var workers = Executors.newFixedThreadPool(2)) {
            Future<?> primeiro = workers.submit(() -> transacao().executeWithoutResult(status -> {
                movimentar(TipoMovimentacaoEstoque.ENTRADA, "5");
                entityManager.flush();
                primeiroTemLock.countDown();
                aguardar(liberarPrimeiro);
            }));
            try {
                aguardar(primeiroTemLock);
                workers.submit(() -> estoque.movimentar(empresaId, outroId, usuarioId,
                        TipoMovimentacaoEstoque.ENTRADA, OrigemMovimentacaoEstoque.MANUAL,
                        new BigDecimal("3"), "Outro produto")).get(5, TimeUnit.SECONDS);
                assertThat(primeiro.isDone()).isFalse();
            } finally {
                liberarPrimeiro.countDown();
                primeiro.get(10, TimeUnit.SECONDS);
            }
        }
        assertThat(produtos.findById(produtoId).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("15");
        assertThat(produtos.findById(outroId).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("3");
        assertThat(movimentos.count()).isEqualTo(2);
    }

    @Test
    void falhaAoGravarHistoricoReverteSaldoJaEnviadoAoBanco() {
        doAnswer(invocation -> {
            entityManager.flush();
            // Consulta SQL na conexao real confirma que o UPDATE ocorreu antes da falha injetada.
            BigDecimal saldo = (BigDecimal) entityManager.createNativeQuery(
                    "select estoque_atual from produtos where id = :id")
                    .setParameter("id", produtoId).getSingleResult();
            assertThat(saldo).isEqualByComparingTo("15");
            throw new IllegalStateException("Falha injetada ao persistir historico");
        }).when(movimentos).save(any(MovimentacaoEstoqueEntity.class));

        assertThatThrownBy(() -> movimentar(TipoMovimentacaoEstoque.ENTRADA, "5"))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("Falha injetada");
        assertThat(produtos.findById(produtoId).orElseThrow().getEstoqueAtual()).isEqualByComparingTo("10");
        assertThat(movimentos.count()).isZero();
    }

    @ParameterizedTest
    @CsvSource({"false,false", "false,true", "true,false", "true,true"})
    void cadastroAntigoNaoSobrescreveEntradaCommitada(boolean transacaoExterna, boolean inativar) throws Exception {
        var cadastroLeuSaldoAntigo = new CountDownLatch(1);
        var entradaCommitada = new CountDownLatch(1);
        // Pausa APOS a leitura real, sem substituir entidades, consultas ou persistencia.
        doAnswer(invocation -> {
            Object resultado = invocation.callRealMethod();
            cadastroLeuSaldoAntigo.countDown();
            aguardar(entradaCommitada);
            return resultado;
        }).when(cadastro).buscarPorId(produtoId, empresaId);

        try (var workers = Executors.newFixedThreadPool(2)) {
            Future<?> edicao = workers.submit(() -> {
                Runnable alterar = () -> {
                    if (inativar) cadastro.inativar(produtoId, empresaId);
                    else cadastro.atualizar(produtoId, dadosCadastrais(), empresaId);
                };
                if (transacaoExterna) transacao().executeWithoutResult(status -> alterar.run());
                else alterar.run();
            });
            try {
                aguardar(cadastroLeuSaldoAntigo);
                workers.submit(() -> movimentar(TipoMovimentacaoEstoque.ENTRADA, "5"))
                        .get(10, TimeUnit.SECONDS);
            } finally {
                entradaCommitada.countDown();
                edicao.get(10, TimeUnit.SECONDS);
            }
        }

        var salvo = produtos.findById(produtoId).orElseThrow();
        assertThat(salvo.getEstoqueAtual()).isEqualByComparingTo("15");
        if (inativar) assertThat(salvo.getAtivo()).isFalse();
        else assertThat(salvo.getNome()).isEqualTo("Produto atualizado");
        assertThat(movimentos.findAll()).singleElement().satisfies(movimento -> {
            assertThat(movimento.getSaldoAnterior()).isEqualByComparingTo("10");
            assertThat(movimento.getSaldoPosterior()).isEqualByComparingTo("15");
        });
    }

    private MovimentacaoEstoqueEntity movimentar(TipoMovimentacaoEstoque tipo, String quantidade) {
        return estoque.movimentar(empresaId, produtoId, usuarioId, tipo,
                OrigemMovimentacaoEstoque.MANUAL, new BigDecimal(quantidade), "Concorrencia");
    }

    private ProdutoEntity dadosCadastrais() {
        var produto = new ProdutoEntity();
        produto.setNome("Produto atualizado");
        produto.setUnidadeMedida("UN");
        produto.setPrecoVenda(new BigDecimal("20"));
        return produto;
    }

    private TransactionTemplate transacao() {
        return new TransactionTemplate(transactionManager);
    }

    private static void aguardar(CountDownLatch latch) {
        try {
            assertThat(latch.await(10, TimeUnit.SECONDS)).as("barreira entre transacoes").isTrue();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class SqlConfig {
        @Bean SqlProbe sqlProbe() { return new SqlProbe(); }
        @Bean HibernatePropertiesCustomizer observarSql(SqlProbe probe) {
            return properties -> properties.put("hibernate.session_factory.statement_inspector", probe);
        }
    }

    static class SqlProbe implements StatementInspector {
        volatile Consumer<String> observar = sql -> {};
        @Override public String inspect(String sql) {
            observar.accept(sql);
            return sql;
        }
    }
}
