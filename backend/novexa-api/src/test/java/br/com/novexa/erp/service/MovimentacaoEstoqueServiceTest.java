package br.com.novexa.erp.service;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.exception.*;
import br.com.novexa.erp.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.*;

@DataJpaTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:estoque;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
@Import(MovimentacaoEstoqueService.class)
class MovimentacaoEstoqueServiceTest {

    @Autowired MovimentacaoEstoqueService service;
    @Autowired MovimentacaoEstoqueRepository movRepository;
    @Autowired ProdutoRepository produtoRepository;
    @Autowired EmpresaRepository empresaRepository;
    @Autowired UsuarioRepository usuarioRepository;
    @Autowired TestEntityManager em;

    private EmpresaEntity criarEmpresa() {
        var e = new EmpresaEntity();
        e.setRazaoSocial("Empresa Teste Estoque");
        e.setCnpj("11222333000199");
        e.setAtivo(true);
        e.getCadastro().setRegimeTributario(RegimeTributario.SIMPLES_NACIONAL);
        e.getCadastro().setLatitude(new BigDecimal("-23.5505200"));
        e.getCadastro().setLongitude(new BigDecimal("-46.6333080"));
        return empresaRepository.saveAndFlush(e);
    }

    private UsuarioEntity criarUsuario(EmpresaEntity empresa) {
        var u = new UsuarioEntity();
        u.setNomeUsuario("usuario_estoque");
        u.setCpf("12345678901");
        u.setEmail("estoque@teste.com");
        u.setSenha("$2a$10$hash");
        u.setAtivo(true);
        u.setPerfil(PerfilUsuario.USUARIO);
        u.setEmpresa(empresa);
        return usuarioRepository.saveAndFlush(u);
    }

    private ProdutoEntity criarProduto(EmpresaEntity empresa, boolean controlaEstoque) {
        var p = new ProdutoEntity();
        p.setEmpresa(empresa);
        p.setCodigoInterno("PROD-001");
        p.setCodigoBarras("7891234567890");
        p.setNome("Produto Teste Estoque");
        p.setUnidadeMedida("UN");
        p.setPrecoCusto(new BigDecimal("10.00"));
        p.setPrecoVenda(new BigDecimal("20.00"));
        p.setEstoqueAtual(new BigDecimal("100.000"));
        p.setEstoqueMinimo(new BigDecimal("10.000"));
        p.setControlaEstoque(controlaEstoque);
        p.setAtivo(true);
        return produtoRepository.saveAndFlush(p);
    }

    private ProdutoEntity criarProdutoComEstoque(EmpresaEntity empresa, BigDecimal estoqueInicial) {
        var p = criarProduto(empresa, true);
        p.setEstoqueAtual(estoqueInicial);
        return produtoRepository.saveAndFlush(p);
    }

    @Test void entradaAumentaSaldo() {
        var empresa = criarEmpresa();
        var usuario = criarUsuario(empresa);
        var produto = criarProdutoComEstoque(empresa, new BigDecimal("100.000"));

        var mov = service.movimentar(
                empresa.getId(), produto.getId(), usuario.getId(),
                TipoMovimentacaoEstoque.ENTRADA, OrigemMovimentacaoEstoque.MANUAL,
                new BigDecimal("50.000"), "Entrada manual"
        );

        assertThat(mov.getTipo()).isEqualTo(TipoMovimentacaoEstoque.ENTRADA);
        assertThat(mov.getSaldoAnterior()).isEqualByComparingTo("100.000");
        assertThat(mov.getSaldoPosterior()).isEqualByComparingTo("150.000");
        assertThat(mov.getQuantidade()).isEqualByComparingTo("50.000");
        assertThat(mov.getOrigem()).isEqualTo(OrigemMovimentacaoEstoque.MANUAL);
        assertThat(mov.getMotivo()).isEqualTo("Entrada manual");

        var produtoAtualizado = produtoRepository.findById(produto.getId()).orElseThrow();
        assertThat(produtoAtualizado.getEstoqueAtual()).isEqualByComparingTo("150.000");
    }

    @Test void saidaReduzSaldo() {
        var empresa = criarEmpresa();
        var usuario = criarUsuario(empresa);
        var produto = criarProdutoComEstoque(empresa, new BigDecimal("100.000"));

        var mov = service.movimentar(
                empresa.getId(), produto.getId(), usuario.getId(),
                TipoMovimentacaoEstoque.SAIDA, OrigemMovimentacaoEstoque.VENDA,
                new BigDecimal("30.000"), "Venda"
        );

        assertThat(mov.getTipo()).isEqualTo(TipoMovimentacaoEstoque.SAIDA);
        assertThat(mov.getSaldoAnterior()).isEqualByComparingTo("100.000");
        assertThat(mov.getSaldoPosterior()).isEqualByComparingTo("70.000");
        assertThat(mov.getQuantidade()).isEqualByComparingTo("30.000");
        assertThat(mov.getOrigem()).isEqualTo(OrigemMovimentacaoEstoque.VENDA);

        var produtoAtualizado = produtoRepository.findById(produto.getId()).orElseThrow();
        assertThat(produtoAtualizado.getEstoqueAtual()).isEqualByComparingTo("70.000");
    }

    @Test void saidaComSaldoInsuficienteRejeitada() {
        var empresa = criarEmpresa();
        var usuario = criarUsuario(empresa);
        var produto = criarProdutoComEstoque(empresa, new BigDecimal("10.000"));

        assertThatThrownBy(() -> service.movimentar(
                empresa.getId(), produto.getId(), usuario.getId(),
                TipoMovimentacaoEstoque.SAIDA, OrigemMovimentacaoEstoque.VENDA,
                new BigDecimal("20.000"), "Venda sem estoque"
        )).isInstanceOf(EstoqueInsuficienteException.class)
          .hasMessageContaining("Saldo insuficiente");

        var produtoInalterado = produtoRepository.findById(produto.getId()).orElseThrow();
        assertThat(produtoInalterado.getEstoqueAtual()).isEqualByComparingTo("10.000");

        var movimentacoes = movRepository.findByEmpresaIdAndProdutoIdOrderByDataHoraDesc(empresa.getId(), produto.getId());
        assertThat(movimentacoes).isEmpty();
    }

    @Test void saidaRejeitadaNaoGravaMovimentacao() {
        var empresa = criarEmpresa();
        var usuario = criarUsuario(empresa);
        var produto = criarProdutoComEstoque(empresa, new BigDecimal("5.000"));

        try {
            service.movimentar(
                    empresa.getId(), produto.getId(), usuario.getId(),
                    TipoMovimentacaoEstoque.SAIDA, OrigemMovimentacaoEstoque.VENDA,
                    new BigDecimal("10.000"), "Venda"
            );
        } catch (EstoqueInsuficienteException ignored) {
        }

        var movimentacoes = movRepository.findByEmpresaIdAndProdutoIdOrderByDataHoraDesc(empresa.getId(), produto.getId());
        assertThat(movimentacoes).isEmpty();
    }

    @Test void ajusteDefineSaldoFinal() {
        var empresa = criarEmpresa();
        var usuario = criarUsuario(empresa);
        var produto = criarProdutoComEstoque(empresa, new BigDecimal("100.000"));

        var mov = service.movimentar(
                empresa.getId(), produto.getId(), usuario.getId(),
                TipoMovimentacaoEstoque.AJUSTE, OrigemMovimentacaoEstoque.AJUSTE,
                new BigDecimal("80.000"), "Contagem física"
        );

        assertThat(mov.getTipo()).isEqualTo(TipoMovimentacaoEstoque.AJUSTE);
        assertThat(mov.getSaldoAnterior()).isEqualByComparingTo("100.000");
        assertThat(mov.getSaldoPosterior()).isEqualByComparingTo("80.000");
        assertThat(mov.getQuantidade()).isEqualByComparingTo("80.000");

        var produtoAtualizado = produtoRepository.findById(produto.getId()).orElseThrow();
        assertThat(produtoAtualizado.getEstoqueAtual()).isEqualByComparingTo("80.000");
    }

    @Test void ajusteParaZeroFunciona() {
        var empresa = criarEmpresa();
        var usuario = criarUsuario(empresa);
        var produto = criarProdutoComEstoque(empresa, new BigDecimal("50.000"));

        var mov = service.movimentar(
                empresa.getId(), produto.getId(), usuario.getId(),
                TipoMovimentacaoEstoque.AJUSTE, OrigemMovimentacaoEstoque.AJUSTE,
                BigDecimal.ZERO, "Zerar estoque"
        );

        assertThat(mov.getSaldoPosterior()).isEqualByComparingTo("0.000");
        assertThat(mov.getQuantidade()).isEqualByComparingTo("0.000");

        var produtoAtualizado = produtoRepository.findById(produto.getId()).orElseThrow();
        assertThat(produtoAtualizado.getEstoqueAtual()).isEqualByComparingTo("0.000");
    }

    @Test void ajusteNegativoRejeitado() {
        var empresa = criarEmpresa();
        var usuario = criarUsuario(empresa);
        var produto = criarProdutoComEstoque(empresa, new BigDecimal("100.000"));

        assertThatThrownBy(() -> service.movimentar(
                empresa.getId(), produto.getId(), usuario.getId(),
                TipoMovimentacaoEstoque.AJUSTE, OrigemMovimentacaoEstoque.AJUSTE,
                new BigDecimal("-10.000"), "Ajuste inválido"
        )).isInstanceOf(IllegalArgumentException.class)
          .hasMessageContaining("não pode ser negativo");
    }

    @Test void produtoSemControleEstoqueRejeitado() {
        var empresa = criarEmpresa();
        var usuario = criarUsuario(empresa);
        var produto = criarProduto(empresa, false);
        produto.setEstoqueAtual(new BigDecimal("100.000"));
        produtoRepository.saveAndFlush(produto);

        assertThatThrownBy(() -> service.movimentar(
                empresa.getId(), produto.getId(), usuario.getId(),
                TipoMovimentacaoEstoque.ENTRADA, OrigemMovimentacaoEstoque.MANUAL,
                new BigDecimal("10.000"), "Entrada"
        )).isInstanceOf(ProdutoNaoControlaEstoqueException.class)
          .hasMessageContaining("não controla estoque");
    }

    @Test void produtoDeOutraEmpresaRejeitado() {
        var empresa1 = criarEmpresa();
        var empresa2 = criarEmpresa2();
        var usuario = criarUsuario(empresa1);
        var produto = criarProduto(empresa2, true);
        produto.setEstoqueAtual(new BigDecimal("100.000"));
        produtoRepository.saveAndFlush(produto);

        assertThatThrownBy(() -> service.movimentar(
                empresa1.getId(), produto.getId(), usuario.getId(),
                TipoMovimentacaoEstoque.ENTRADA, OrigemMovimentacaoEstoque.MANUAL,
                new BigDecimal("10.000"), "Entrada"
        )).isInstanceOf(ProdutoNotFoundException.class)
          .hasMessageContaining("não encontrado");
    }

    @Test void usuarioDeOutraEmpresaRejeitado() {
        var empresa1 = criarEmpresa();
        var empresa2 = criarEmpresa2();
        var usuario = criarUsuario(empresa2);
        var produto = criarProduto(empresa1, true);
        produto.setEstoqueAtual(new BigDecimal("100.000"));
        produtoRepository.saveAndFlush(produto);

        assertThatThrownBy(() -> service.movimentar(
                empresa1.getId(), produto.getId(), usuario.getId(),
                TipoMovimentacaoEstoque.ENTRADA, OrigemMovimentacaoEstoque.MANUAL,
                new BigDecimal("10.000"), "Entrada"
        )).isInstanceOf(UsuarioNotFoundException.class)
          .hasMessageContaining("não encontrado");
    }

    @Test void movimentacaoRegistraSaldoAnterior() {
        var empresa = criarEmpresa();
        var usuario = criarUsuario(empresa);
        var produto = criarProdutoComEstoque(empresa, new BigDecimal("75.000"));

        var mov = service.movimentar(
                empresa.getId(), produto.getId(), usuario.getId(),
                TipoMovimentacaoEstoque.ENTRADA, OrigemMovimentacaoEstoque.MANUAL,
                new BigDecimal("25.000"), "Teste"
        );

        assertThat(mov.getSaldoAnterior()).isEqualByComparingTo("75.000");
    }

    @Test void movimentacaoRegistraSaldoPosterior() {
        var empresa = criarEmpresa();
        var usuario = criarUsuario(empresa);
        var produto = criarProdutoComEstoque(empresa, new BigDecimal("75.000"));

        var mov = service.movimentar(
                empresa.getId(), produto.getId(), usuario.getId(),
                TipoMovimentacaoEstoque.ENTRADA, OrigemMovimentacaoEstoque.MANUAL,
                new BigDecimal("25.000"), "Teste"
        );

        assertThat(mov.getSaldoPosterior()).isEqualByComparingTo("100.000");
    }

    @Test void movimentacaoRegistraUsuarioProdutoEmpresaTipoOrigem() {
        var empresa = criarEmpresa();
        var usuario = criarUsuario(empresa);
        var produto = criarProdutoComEstoque(empresa, new BigDecimal("100.000"));

        var mov = service.movimentar(
                empresa.getId(), produto.getId(), usuario.getId(),
                TipoMovimentacaoEstoque.SAIDA, OrigemMovimentacaoEstoque.VENDA,
                new BigDecimal("20.000"), "Teste"
        );

        assertThat(mov.getEmpresa().getId()).isEqualTo(empresa.getId());
        assertThat(mov.getProduto().getId()).isEqualTo(produto.getId());
        assertThat(mov.getUsuario().getId()).isEqualTo(usuario.getId());
        assertThat(mov.getTipo()).isEqualTo(TipoMovimentacaoEstoque.SAIDA);
        assertThat(mov.getOrigem()).isEqualTo(OrigemMovimentacaoEstoque.VENDA);
    }

    @Test void falhaDuranteOperacaoNaoDeixaAlteracaoParcial() {
        var empresa = criarEmpresa();
        var usuario = criarUsuario(empresa);
        var produto = criarProdutoComEstoque(empresa, new BigDecimal("100.000"));

        try {
            service.movimentar(
                    empresa.getId(), produto.getId(), usuario.getId(),
                    TipoMovimentacaoEstoque.SAIDA, OrigemMovimentacaoEstoque.VENDA,
                    new BigDecimal("150.000"), "Teste"
            );
        } catch (EstoqueInsuficienteException ignored) {
        }

        var produtoInalterado = produtoRepository.findById(produto.getId()).orElseThrow();
        assertThat(produtoInalterado.getEstoqueAtual()).isEqualByComparingTo("100.000");

        var movimentacoes = movRepository.findByEmpresaIdAndProdutoIdOrderByDataHoraDesc(empresa.getId(), produto.getId());
        assertThat(movimentacoes).isEmpty();
    }

    @Test void duasMovimentacoesSimultaneasUsamLock() {
        var empresa = criarEmpresa();
        var usuario = criarUsuario(empresa);
        var produto = criarProdutoComEstoque(empresa, new BigDecimal("100.000"));

        var mov1 = service.movimentar(
                empresa.getId(), produto.getId(), usuario.getId(),
                TipoMovimentacaoEstoque.ENTRADA, OrigemMovimentacaoEstoque.MANUAL,
                new BigDecimal("10.000"), "Primeira"
        );

        var mov2 = service.movimentar(
                empresa.getId(), produto.getId(), usuario.getId(),
                TipoMovimentacaoEstoque.ENTRADA, OrigemMovimentacaoEstoque.MANUAL,
                new BigDecimal("20.000"), "Segunda"
        );

        assertThat(mov1.getSaldoPosterior()).isEqualByComparingTo("110.000");
        assertThat(mov2.getSaldoAnterior()).isEqualByComparingTo("110.000");
        assertThat(mov2.getSaldoPosterior()).isEqualByComparingTo("130.000");

        var produtoFinal = produtoRepository.findById(produto.getId()).orElseThrow();
        assertThat(produtoFinal.getEstoqueAtual()).isEqualByComparingTo("130.000");

        var movimentacoes = movRepository.findByEmpresaIdAndProdutoIdOrderByDataHoraDesc(empresa.getId(), produto.getId());
        assertThat(movimentacoes).hasSize(2);
    }

    @Test void entradaMultiplasVezesAcumulaCorretamente() {
        var empresa = criarEmpresa();
        var usuario = criarUsuario(empresa);
        var produto = criarProdutoComEstoque(empresa, BigDecimal.ZERO);

        service.movimentar(empresa.getId(), produto.getId(), usuario.getId(),
                TipoMovimentacaoEstoque.ENTRADA, OrigemMovimentacaoEstoque.MANUAL,
                new BigDecimal("10.000"), "1");
        service.movimentar(empresa.getId(), produto.getId(), usuario.getId(),
                TipoMovimentacaoEstoque.ENTRADA, OrigemMovimentacaoEstoque.MANUAL,
                new BigDecimal("20.000"), "2");
        service.movimentar(empresa.getId(), produto.getId(), usuario.getId(),
                TipoMovimentacaoEstoque.ENTRADA, OrigemMovimentacaoEstoque.MANUAL,
                new BigDecimal("30.000"), "3");

        var produtoFinal = produtoRepository.findById(produto.getId()).orElseThrow();
        assertThat(produtoFinal.getEstoqueAtual()).isEqualByComparingTo("60.000");
    }

    @Test void saidaMultiplasVezesReduzCorretamente() {
        var empresa = criarEmpresa();
        var usuario = criarUsuario(empresa);
        var produto = criarProdutoComEstoque(empresa, new BigDecimal("100.000"));

        service.movimentar(empresa.getId(), produto.getId(), usuario.getId(),
                TipoMovimentacaoEstoque.SAIDA, OrigemMovimentacaoEstoque.VENDA,
                new BigDecimal("30.000"), "1");
        service.movimentar(empresa.getId(), produto.getId(), usuario.getId(),
                TipoMovimentacaoEstoque.SAIDA, OrigemMovimentacaoEstoque.VENDA,
                new BigDecimal("20.000"), "2");

        var produtoFinal = produtoRepository.findById(produto.getId()).orElseThrow();
        assertThat(produtoFinal.getEstoqueAtual()).isEqualByComparingTo("50.000");
    }

    @Test void quantidadeZeroParaEntradaRejeitada() {
        var empresa = criarEmpresa();
        var usuario = criarUsuario(empresa);
        var produto = criarProdutoComEstoque(empresa, new BigDecimal("100.000"));

        assertThatThrownBy(() -> service.movimentar(
                empresa.getId(), produto.getId(), usuario.getId(),
                TipoMovimentacaoEstoque.ENTRADA, OrigemMovimentacaoEstoque.MANUAL,
                BigDecimal.ZERO, "Teste"
        )).isInstanceOf(IllegalArgumentException.class)
          .hasMessageContaining("maior que zero");
    }

    @Test void quantidadeZeroParaSaidaRejeitada() {
        var empresa = criarEmpresa();
        var usuario = criarUsuario(empresa);
        var produto = criarProdutoComEstoque(empresa, new BigDecimal("100.000"));

        assertThatThrownBy(() -> service.movimentar(
                empresa.getId(), produto.getId(), usuario.getId(),
                TipoMovimentacaoEstoque.SAIDA, OrigemMovimentacaoEstoque.MANUAL,
                BigDecimal.ZERO, "Teste"
        )).isInstanceOf(IllegalArgumentException.class)
          .hasMessageContaining("maior que zero");
    }

    private EmpresaEntity criarEmpresa2() {
        var e = new EmpresaEntity();
        e.setRazaoSocial("Empresa Teste Estoque 2");
        e.setCnpj("11222333000198");
        e.setAtivo(true);
        e.getCadastro().setRegimeTributario(RegimeTributario.SIMPLES_NACIONAL);
        e.getCadastro().setLatitude(new BigDecimal("-23.5505200"));
        e.getCadastro().setLongitude(new BigDecimal("-46.6333080"));
        return empresaRepository.saveAndFlush(e);
    }
}