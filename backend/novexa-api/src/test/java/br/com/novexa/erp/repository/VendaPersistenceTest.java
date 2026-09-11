package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

@DataJpaTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:venda;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
class VendaPersistenceTest {

    @Autowired VendaRepository vendas;
    @Autowired ItemVendaRepository itensVenda;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired ProdutoRepository produtos;
    @Autowired ClienteRepository clientes;
    @Autowired TestEntityManager em;

    private EmpresaEntity criarEmpresa(String nome, String cnpj) {
        var e = new EmpresaEntity();
        e.setRazaoSocial(nome); e.setCnpj(cnpj); e.setAtivo(true);
        e.getCadastro().setRegimeTributario(RegimeTributario.SIMPLES_NACIONAL);
        return empresas.saveAndFlush(e);
    }

    private EmpresaEntity criarEmpresa2(String nome, String cnpj) {
        var e = new EmpresaEntity();
        e.setRazaoSocial(nome); e.setCnpj(cnpj); e.setAtivo(true);
        e.getCadastro().setRegimeTributario(RegimeTributario.SIMPLES_NACIONAL);
        return empresas.saveAndFlush(e);
    }

    private UsuarioEntity criarUsuario(EmpresaEntity empresa, String cpf) {
        var u = new UsuarioEntity();
        u.setEmpresa(empresa); u.setCpf(cpf); u.setNomeUsuario("Operador");
        u.setSenha("$2a$10$hash"); u.setAtivo(true); u.setPerfil(PerfilUsuario.USUARIO);
        return usuarios.saveAndFlush(u);
    }

    private ProdutoEntity criarProduto(EmpresaEntity empresa, String nome, String preco, String estoque) {
        var p = new ProdutoEntity();
        p.setEmpresa(empresa); p.setNome(nome); p.setUnidadeMedida("UN");
        p.setPrecoCusto(new BigDecimal("5.00"));
        p.setPrecoVenda(new BigDecimal(preco));
        p.setEstoqueAtual(new BigDecimal(estoque));
        p.setEstoqueMinimo(new BigDecimal("1.000"));
        p.setControlaEstoque(true); p.setAtivo(true);
        return produtos.saveAndFlush(p);
    }

    private ClienteEntity criarCliente(EmpresaEntity empresa, String nome) {
        var c = new ClienteEntity();
        c.setEmpresa(empresa); c.setNome(nome);
        c.setTipoPessoa(TipoPessoa.FISICA); c.setAtivo(true);
        return clientes.saveAndFlush(c);
    }

    private VendaEntity criarVenda(UsuarioEntity usuario, ClienteEntity cliente, BigDecimal subtotal) {
        var v = new VendaEntity(usuario, cliente, UUID.randomUUID(), "resumo",
                subtotal, BigDecimal.ZERO, subtotal, FormaPagamento.DINHEIRO,
                subtotal, BigDecimal.ZERO, null, null);
        return vendas.saveAndFlush(v);
    }

    @Test
    void devePersistirVendaComEmpresaEUsuario() {
        var empresa = criarEmpresa("Empresa Teste", "11222333000181");
        var usuario = criarUsuario(empresa, "02360684663");
        var v = criarVenda(usuario, null, new BigDecimal("10.00"));
        em.clear();

        var rec = vendas.findById(v.getId()).orElseThrow();
        assertThat(rec.getId()).isEqualTo(v.getId());
        assertThat(rec.getEmpresa().getId()).isEqualTo(empresa.getId());
        assertThat(rec.getUsuario().getId()).isEqualTo(usuario.getId());
        assertThat(rec.getDataHora()).isNotNull();
    }

    @Test
    void devePersistirVendaSemCliente() {
        var empresa = criarEmpresa("Empresa Teste", "11222333000181");
        var usuario = criarUsuario(empresa, "02360684663");
        var v = criarVenda(usuario, null, new BigDecimal("10.00"));
        em.clear();

        var rec = vendas.findById(v.getId()).orElseThrow();
        assertThat(rec.getCliente()).isNull();
    }

    @Test
    void devePersistirVendaComCliente() {
        var empresa = criarEmpresa("Empresa Teste", "11222333000181");
        var usuario = criarUsuario(empresa, "02360684663");
        var cliente = criarCliente(empresa, "Cliente Teste");
        var v = criarVenda(usuario, cliente, new BigDecimal("10.00"));
        em.clear();

        var rec = vendas.findById(v.getId()).orElseThrow();
        assertThat(rec.getCliente()).isNotNull();
        assertThat(rec.getCliente().getId()).isEqualTo(cliente.getId());
        assertThat(rec.getCliente().getNome()).isEqualTo("Cliente Teste");
    }

    @Test
    void devePersistirStatusAberta() {
        var empresa = criarEmpresa("Empresa Teste", "11222333000181");
        var usuario = criarUsuario(empresa, "02360684663");
        var v = criarVenda(usuario, null, new BigDecimal("10.00"));
        em.clear();

        var rec = vendas.findById(v.getId()).orElseThrow();
        assertThat(rec.getStatus()).isEqualTo(StatusVenda.ABERTA);
    }

    @Test
    void devePersistirValoresMonetarios() {
        var empresa = criarEmpresa("Empresa Teste", "11222333000181");
        var usuario = criarUsuario(empresa, "02360684663");
        var v = new VendaEntity(usuario, null, UUID.randomUUID(), "resumo",
                new BigDecimal("1234.56"), new BigDecimal("100.00"), new BigDecimal("1134.56"),
                FormaPagamento.PIX, new BigDecimal("2000.00"), new BigDecimal("865.44"), null, null);
        vendas.saveAndFlush(v);
        em.clear();

        var rec = vendas.findById(v.getId()).orElseThrow();
        assertThat(rec.getSubtotal()).isEqualByComparingTo("1234.56");
        assertThat(rec.getDesconto()).isEqualByComparingTo("100.00");
        assertThat(rec.getTotal()).isEqualByComparingTo("1134.56");
    }

    @Test
    void devePersistirItemVenda() {
        var empresa = criarEmpresa("Empresa Teste", "11222333000181");
        var usuario = criarUsuario(empresa, "02360684663");
        var produto = criarProduto(empresa, "Produto", "10.00", "100.000");
        var v = criarVenda(usuario, null, new BigDecimal("10.00"));

        var item = new ItemVendaEntity(v, produto, new BigDecimal("2.000"),
                new BigDecimal("10.00"), new BigDecimal("20.00"));
        itensVenda.saveAndFlush(item);
        em.clear();

        var rec = itensVenda.findById(item.getId()).orElseThrow();
        assertThat(rec.getId()).isEqualTo(item.getId());
        assertThat(rec.getQuantidade()).isEqualByComparingTo("2.000");
        assertThat(rec.getPrecoUnitario()).isEqualByComparingTo("10.00");
        assertThat(rec.getSubtotal()).isEqualByComparingTo("20.00");
    }

    @Test
    void itemVendaMantemVinculoComProduto() {
        var empresa = criarEmpresa("Empresa Teste", "11222333000181");
        var usuario = criarUsuario(empresa, "02360684663");
        var produto = criarProduto(empresa, "Produto", "10.00", "100.000");
        var v = criarVenda(usuario, null, new BigDecimal("10.00"));

        var item = new ItemVendaEntity(v, produto, new BigDecimal("1.000"),
                new BigDecimal("10.00"), new BigDecimal("10.00"));
        itensVenda.saveAndFlush(item);
        em.clear();

        var rec = itensVenda.findById(item.getId()).orElseThrow();
        assertThat(rec.getProduto()).isNotNull();
        assertThat(rec.getProduto().getId()).isEqualTo(produto.getId());
        assertThat(rec.getProduto().getNome()).isEqualTo("Produto");
    }

    @Test
    void itemVendaMantemPrecoAplicadoIndependenteDoPrecoAtual() {
        var empresa = criarEmpresa("Empresa Teste", "11222333000181");
        var usuario = criarUsuario(empresa, "02360684663");
        var produto = criarProduto(empresa, "Produto", "10.00", "100.000");
        var v = criarVenda(usuario, null, new BigDecimal("10.00"));

        var item = new ItemVendaEntity(v, produto, new BigDecimal("1.000"),
                new BigDecimal("8.50"), new BigDecimal("8.50"));
        itensVenda.saveAndFlush(item);

        produto.setPrecoVenda(new BigDecimal("15.00"));
        produtos.saveAndFlush(produto);
        em.clear();

        var rec = itensVenda.findById(item.getId()).orElseThrow();
        assertThat(rec.getPrecoUnitario()).isEqualByComparingTo("8.50");
        assertThat(rec.getProduto().getPrecoVenda()).isEqualByComparingTo("15.00");
    }

    @Test
    void devePersistirQuantidadeBigDecimal() {
        var empresa = criarEmpresa("Empresa Teste", "11222333000181");
        var usuario = criarUsuario(empresa, "02360684663");
        var produto = criarProduto(empresa, "Produto", "10.00", "100.000");
        var v = criarVenda(usuario, null, new BigDecimal("10.00"));

        var item = new ItemVendaEntity(v, produto, new BigDecimal("1.234"),
                new BigDecimal("10.00"), new BigDecimal("12.34"));
        itensVenda.saveAndFlush(item);
        em.clear();

        var rec = itensVenda.findById(item.getId()).orElseThrow();
        assertThat(rec.getQuantidade()).isEqualByComparingTo("1.234");
        assertThat(rec.getQuantidade().scale()).isEqualTo(3);
    }

    @Test
    void vendaRecuperaSeusItens() {
        var empresa = criarEmpresa("Empresa Teste", "11222333000181");
        var usuario = criarUsuario(empresa, "02360684663");
        var produto = criarProduto(empresa, "Produto", "10.00", "100.000");
        var v = criarVenda(usuario, null, new BigDecimal("10.00"));

        var item1 = new ItemVendaEntity(v, produto, new BigDecimal("1.000"),
                new BigDecimal("10.00"), new BigDecimal("10.00"));
        var item2 = new ItemVendaEntity(v, produto, new BigDecimal("2.000"),
                new BigDecimal("10.00"), new BigDecimal("20.00"));
        itensVenda.saveAndFlush(item1);
        itensVenda.saveAndFlush(item2);
        em.clear();

        var rec = vendas.findById(v.getId()).orElseThrow();
        assertThat(rec.getItemVendas()).hasSize(2);
    }

    @Test
    void muitosItensPertencemAMesmaVenda() {
        var empresa = criarEmpresa("Empresa Teste", "11222333000181");
        var usuario = criarUsuario(empresa, "02360684663");
        var produto = criarProduto(empresa, "Produto", "10.00", "100.000");
        var v = criarVenda(usuario, null, new BigDecimal("30.00"));

        var item1 = new ItemVendaEntity(v, produto, new BigDecimal("1.000"),
                new BigDecimal("10.00"), new BigDecimal("10.00"));
        var item2 = new ItemVendaEntity(v, produto, new BigDecimal("2.000"),
                new BigDecimal("10.00"), new BigDecimal("20.00"));
        itensVenda.saveAndFlush(item1);
        itensVenda.saveAndFlush(item2);
        em.clear();

        var rec = vendas.findById(v.getId()).orElseThrow();
        assertThat(rec.getItemVendas()).hasSize(2);

        var itensRecuperados = itensVenda.findByVendaId(v.getId());
        assertThat(itensRecuperados).hasSize(2);
        assertThat(itensRecuperados.stream().map(ItemVendaEntity::getVenda))
                .allMatch(venda -> venda.getId().equals(v.getId()));
    }

    @Test
    void vendaEmpresaAIsoladaDaEmpresaB() {
        var empresaA = criarEmpresa("Empresa A", "11222333000181");
        var empresaB = criarEmpresa2("Empresa B", "12345678000190");
        var usuarioA = criarUsuario(empresaA, "02360684663");
        var usuarioB = criarUsuario(empresaB, "11144477735");
        var produtoA = criarProduto(empresaA, "Produto A", "10.00", "100.000");
        var produtoB = criarProduto(empresaB, "Produto B", "20.00", "50.000");

        var vendaA = criarVenda(usuarioA, null, new BigDecimal("10.00"));
        var vendaB = criarVenda(usuarioB, null, new BigDecimal("20.00"));
        em.clear();

        var recA = vendas.findByIdAndEmpresaId(vendaA.getId(), empresaA.getId());
        var recB = vendas.findByIdAndEmpresaId(vendaA.getId(), empresaB.getId());

        assertThat(recA).isPresent();
        assertThat(recA.get().getEmpresa().getId()).isEqualTo(empresaA.getId());
        assertThat(recB).isEmpty();
    }
}
