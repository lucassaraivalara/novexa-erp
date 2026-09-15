package br.com.novexa.erp.service;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.*;

@DataJpaTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:venda5b;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.open-in-view=false", "spring.jpa.show-sql=false",
        "spring.flyway.enabled=false"
})
@Import({VendaService.class, MovimentacaoEstoqueService.class, PagamentoService.class, FormaPagamentoService.class})
@org.springframework.test.context.jdbc.Sql("/formas-pagamento-fixture.sql")
@ActiveProfiles("test")
class VendaServiceTest {

    @Autowired VendaService service;
    @Autowired VendaRepository vendas;
    @Autowired ItemVendaRepository itensVenda;
    @Autowired ProdutoRepository produtos;
    @Autowired ClienteRepository clientes;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;

    EmpresaEntity empresa, outra;
    UsuarioEntity operador;
    ProdutoEntity produto;
    ClienteEntity cliente;
    UsuarioAutenticado autenticado;

    @BeforeEach
    void preparar() {
        empresa = empresas.saveAndFlush(empresa("Empresa A", "11222333000181"));
        outra = empresas.saveAndFlush(empresa("Empresa B", "12345678000190"));
        operador = usuarios.saveAndFlush(usuario(empresa, "02360684663"));
        produto = produtos.saveAndFlush(produto(empresa, "Produto", "10.00", "10.000"));
        cliente = clientes.saveAndFlush(cliente(empresa, "Cliente"));
        autenticado = new UsuarioAutenticado(operador.getId(), operador.getCpf(), empresa.getId(), PerfilUsuario.USUARIO);
    }

    @Test
    void criarVendaAberta() {
        var venda = service.criarVendaAberta(autenticado);
        assertThat(venda.id()).isNotNull();
        assertThat(venda.subtotal()).isEqualByComparingTo("0.00");
        assertThat(venda.desconto()).isEqualByComparingTo("0.00");
        assertThat(venda.total()).isEqualByComparingTo("0.00");
        assertThat(venda.clienteId()).isNull();
        var entity = vendas.findById(venda.id()).orElseThrow();
        assertThat(entity.getStatus()).isEqualTo(StatusVenda.ABERTA);
    }

    @Test
    void vendaPodeExistirSemCliente() {
        var venda = service.criarVendaAberta(autenticado);
        assertThat(venda.clienteId()).isNull();
    }

    @Test
    void adicionarItem() {
        var venda = service.criarVendaAberta(autenticado);
        var result = service.adicionarItem(venda.id(), produto.getId(), new BigDecimal("2"), autenticado);
        assertThat(result.subtotal()).isEqualByComparingTo("20.00");
        assertThat(result.total()).isEqualByComparingTo("20.00");
        var items = itensVenda.findByVendaId(venda.id());
        assertThat(items).hasSize(1);
        assertThat(items.getFirst().getQuantidade()).isEqualByComparingTo("2");
    }

    @Test
    void precoAtualDoProdutoCopiadoParaItem() {
        var venda = service.criarVendaAberta(autenticado);
        service.adicionarItem(venda.id(), produto.getId(), new BigDecimal("1"), autenticado);
        var item = itensVenda.findByVendaId(venda.id()).getFirst();
        assertThat(item.getPrecoUnitario()).isEqualByComparingTo("10.00");
        assertThat(item.getPrecoUnitario()).isEqualByComparingTo(produto.getPrecoVenda());
    }

    @Test
    void mudancaPosteriorPrecoNaoAlteraItem() {
        var venda = service.criarVendaAberta(autenticado);
        service.adicionarItem(venda.id(), produto.getId(), new BigDecimal("1"), autenticado);
        produto.setPrecoVenda(new BigDecimal("25.00"));
        produtos.saveAndFlush(produto);
        var item = itensVenda.findByVendaId(venda.id()).getFirst();
        assertThat(item.getPrecoUnitario()).isEqualByComparingTo("10.00");
    }

    @Test
    void subtotalItemCorreto() {
        var venda = service.criarVendaAberta(autenticado);
        service.adicionarItem(venda.id(), produto.getId(), new BigDecimal("3"), autenticado);
        var item = itensVenda.findByVendaId(venda.id()).getFirst();
        assertThat(item.getSubtotal()).isEqualByComparingTo("30.00");
        assertThat(item.getSubtotal().scale()).isEqualTo(2);
    }

    @Test
    void mesmoProdutoAdicionadoNovamenteSomaQuantidade() {
        var venda = service.criarVendaAberta(autenticado);
        service.adicionarItem(venda.id(), produto.getId(), new BigDecimal("2"), autenticado);
        service.adicionarItem(venda.id(), produto.getId(), new BigDecimal("1"), autenticado);
        var items = itensVenda.findByVendaId(venda.id());
        assertThat(items).hasSize(1);
        assertThat(items.getFirst().getQuantidade()).isEqualByComparingTo("3");
        assertThat(items.getFirst().getSubtotal()).isEqualByComparingTo("30.00");
    }

    @Test
    void alterarQuantidadeRecalculaSubtotal() {
        var venda = service.criarVendaAberta(autenticado);
        service.adicionarItem(venda.id(), produto.getId(), new BigDecimal("2"), autenticado);
        var item = itensVenda.findByVendaId(venda.id()).getFirst();
        service.alterarQuantidade(venda.id(), item.getId(), new BigDecimal("5"), autenticado);
        var atualizado = itensVenda.findById(item.getId()).orElseThrow();
        assertThat(atualizado.getQuantidade()).isEqualByComparingTo("5");
        assertThat(atualizado.getSubtotal()).isEqualByComparingTo("50.00");
    }

    @Test
    void removerItemRecalculaVenda() {
        var venda = service.criarVendaAberta(autenticado);
        service.adicionarItem(venda.id(), produto.getId(), new BigDecimal("2"), autenticado);
        var item = itensVenda.findByVendaId(venda.id()).getFirst();
        service.removerItem(venda.id(), item.getId(), autenticado);
        var result = service.buscar(venda.id(), empresa.getId());
        assertThat(result.subtotal()).isEqualByComparingTo("0.00");
        assertThat(result.total()).isEqualByComparingTo("0.00");
        assertThat(itensVenda.findByVendaId(venda.id())).isEmpty();
    }

    @Test
    void subtotalVendaSomaDosItens() {
        var venda = service.criarVendaAberta(autenticado);
        service.adicionarItem(venda.id(), produto.getId(), new BigDecimal("1"), autenticado);
        service.adicionarItem(venda.id(), produto.getId(), new BigDecimal("2"), autenticado);
        var result = service.buscar(venda.id(), empresa.getId());
        assertThat(result.subtotal()).isEqualByComparingTo("30.00");
    }

    @Test
    void descontoValidoReduzTotal() {
        var venda = service.criarVendaAberta(autenticado);
        service.adicionarItem(venda.id(), produto.getId(), new BigDecimal("3"), autenticado);
        var result = service.aplicarDesconto(venda.id(), new BigDecimal("5.00"), autenticado);
        assertThat(result.subtotal()).isEqualByComparingTo("30.00");
        assertThat(result.desconto()).isEqualByComparingTo("5.00");
        assertThat(result.total()).isEqualByComparingTo("25.00");
    }

    @Test
    void descontoMaiorQueSubtotalRejeitado() {
        var venda = service.criarVendaAberta(autenticado);
        service.adicionarItem(venda.id(), produto.getId(), new BigDecimal("2"), autenticado);
        assertThatThrownBy(() -> service.aplicarDesconto(venda.id(), new BigDecimal("50.00"), autenticado))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void descontoNegativoRejeitado() {
        var venda = service.criarVendaAberta(autenticado);
        assertThatThrownBy(() -> service.aplicarDesconto(venda.id(), new BigDecimal("-5.00"), autenticado))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void clienteMesmaEmpresaPodeVinculado() {
        var venda = service.criarVendaAberta(autenticado);
        var result = service.vincularCliente(venda.id(), cliente.getId(), autenticado);
        assertThat(result.clienteId()).isNotNull();
        assertThat(result.clienteId()).isEqualTo(cliente.getId());
    }

    @Test
    void clienteOutraEmpresaRejeitado() {
        var venda = service.criarVendaAberta(autenticado);
        var clienteOutra = clientes.saveAndFlush(cliente(outra, "Cliente B"));
        assertThatThrownBy(() -> service.vincularCliente(venda.id(), clienteOutra.getId(), autenticado))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void produtoOutraEmpresaRejeitado() {
        var venda = service.criarVendaAberta(autenticado);
        var produtoOutra = produtos.saveAndFlush(produto(outra, "Outro", "20.00", "5.000"));
        assertThatThrownBy(() -> service.adicionarItem(venda.id(), produtoOutra.getId(), new BigDecimal("1"), autenticado))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void vendaFaturadaNaoPodeSerAlterada() {
        var venda = service.criarVendaAberta(autenticado);
        var entity = vendas.findById(venda.id()).orElseThrow();
        entity.setStatus(StatusVenda.FATURADA);
        vendas.saveAndFlush(entity);
        assertThatThrownBy(() -> service.adicionarItem(venda.id(), produto.getId(), new BigDecimal("1"), autenticado))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void vendaCanceladaNaoPodeSerAlterada() {
        var venda = service.criarVendaAberta(autenticado);
        var entity = vendas.findById(venda.id()).orElseThrow();
        entity.setStatus(StatusVenda.CANCELADA);
        vendas.saveAndFlush(entity);
        assertThatThrownBy(() -> service.adicionarItem(venda.id(), produto.getId(), new BigDecimal("1"), autenticado))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void falhaNaoDeixaAlteracaoParcial() {
        var venda = service.criarVendaAberta(autenticado);
        var vendaId = venda.id();
        service.adicionarItem(vendaId, produto.getId(), new BigDecimal("2"), autenticado);
        var itemId = itensVenda.findByVendaId(vendaId).getFirst().getId();
        assertThatThrownBy(() -> service.alterarQuantidade(vendaId, itemId, BigDecimal.ZERO, autenticado))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void valoresBigDecimalMantemPrecisao() {
        var venda = service.criarVendaAberta(autenticado);
        service.adicionarItem(venda.id(), produto.getId(), new BigDecimal("1.234"), autenticado);
        var item = itensVenda.findByVendaId(venda.id()).getFirst();
        assertThat(item.getQuantidade().scale()).isEqualTo(3);
        assertThat(item.getSubtotal()).isEqualByComparingTo("12.34");
        assertThat(item.getSubtotal().scale()).isEqualTo(2);
    }

    @Test
    void removerClienteEnquantoAberta() {
        var venda = service.criarVendaAberta(autenticado);
        service.vincularCliente(venda.id(), cliente.getId(), autenticado);
        var result = service.removerCliente(venda.id(), autenticado);
        assertThat(result.clienteId()).isNull();
    }

    @Test
    void quantidadeZeroRejeitado() {
        var venda = service.criarVendaAberta(autenticado);
        assertThatThrownBy(() -> service.adicionarItem(venda.id(), produto.getId(), BigDecimal.ZERO, autenticado))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void produtoInativoRejeitado() {
        var venda = service.criarVendaAberta(autenticado);
        produto.setAtivo(false);
        produtos.saveAndFlush(produto);
        assertThatThrownBy(() -> service.adicionarItem(venda.id(), produto.getId(), new BigDecimal("1"), autenticado))
                .isInstanceOf(ResponseStatusException.class);
    }

    private EmpresaEntity empresa(String nome, String cnpj) {
        var e = new EmpresaEntity();
        e.setRazaoSocial(nome); e.setCnpj(cnpj); e.setAtivo(true);
        return empresas.saveAndFlush(e);
    }

    private UsuarioEntity usuario(EmpresaEntity empresa, String cpf) {
        var u = new UsuarioEntity();
        u.setEmpresa(empresa); u.setCpf(cpf); u.setNomeUsuario("Operador");
        u.setSenha("$2a$10$hash"); u.setAtivo(true); u.setPerfil(PerfilUsuario.USUARIO);
        return usuarios.saveAndFlush(u);
    }

    private ProdutoEntity produto(EmpresaEntity empresa, String nome, String preco, String saldo) {
        var p = new ProdutoEntity(); p.setEmpresa(empresa); p.setNome(nome); p.setUnidadeMedida("UN");
        p.setPrecoCusto(new BigDecimal("5.00")); p.setPrecoVenda(new BigDecimal(preco));
        p.setEstoqueAtual(new BigDecimal(saldo)); p.setEstoqueMinimo(new BigDecimal("1.000"));
        p.setControlaEstoque(true); p.setAtivo(true);
        return produtos.saveAndFlush(p);
    }

    private ClienteEntity cliente(EmpresaEntity empresa, String nome) {
        var c = new ClienteEntity(); c.setEmpresa(empresa); c.setNome(nome);
        c.setTipoPessoa(TipoPessoa.FISICA); c.setAtivo(true);
        return clientes.saveAndFlush(c);
    }
}
