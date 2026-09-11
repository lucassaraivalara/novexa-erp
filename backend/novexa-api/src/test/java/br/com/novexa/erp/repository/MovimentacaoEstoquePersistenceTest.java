package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import static org.assertj.core.api.Assertions.*;

@DataJpaTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:estoque;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
class MovimentacaoEstoquePersistenceTest {

    @Autowired MovimentacaoEstoqueRepository repository;
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
        e.getCadastro().setLatitude(new java.math.BigDecimal("-23.5505200"));
        e.getCadastro().setLongitude(new java.math.BigDecimal("-46.6333080"));
        return empresaRepository.saveAndFlush(e);
    }

    private EmpresaEntity criarEmpresa2() {
        var e = new EmpresaEntity();
        e.setRazaoSocial("Empresa Teste Estoque 2");
        e.setCnpj("11222333000198");
        e.setAtivo(true);
        e.getCadastro().setRegimeTributario(RegimeTributario.SIMPLES_NACIONAL);
        e.getCadastro().setLatitude(new java.math.BigDecimal("-23.5505200"));
        e.getCadastro().setLongitude(new java.math.BigDecimal("-46.6333080"));
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

    private ProdutoEntity criarProduto(EmpresaEntity empresa) {
        var p = new ProdutoEntity();
        p.setEmpresa(empresa);
        p.setCodigoInterno("PROD-001");
        p.setCodigoBarras("7891234567890");
        p.setNome("Produto Teste Estoque");
        p.setUnidadeMedida("UN");
        p.setPrecoCusto(new java.math.BigDecimal("10.00"));
        p.setPrecoVenda(new java.math.BigDecimal("20.00"));
        p.setEstoqueAtual(new java.math.BigDecimal("100.000"));
        p.setEstoqueMinimo(new java.math.BigDecimal("10.000"));
        p.setControlaEstoque(true);
        p.setAtivo(true);
        return produtoRepository.saveAndFlush(p);
    }

    @Test void deveGravarMovimentacaoComVinculosCorretos() {
        var empresa = criarEmpresa();
        var usuario = criarUsuario(empresa);
        var produto = criarProduto(empresa);

        var mov = new MovimentacaoEstoqueEntity();
        mov.setEmpresa(empresa);
        mov.setProduto(produto);
        mov.setUsuario(usuario);
        mov.setTipo(TipoMovimentacaoEstoque.ENTRADA);
        mov.setOrigem(OrigemMovimentacaoEstoque.MANUAL);
        mov.setQuantidade(new java.math.BigDecimal("50.000"));
        mov.setSaldoAnterior(new java.math.BigDecimal("100.000"));
        mov.setSaldoPosterior(new java.math.BigDecimal("150.000"));
        mov.setMotivo("Entrada manual de estoque");

        var salva = repository.saveAndFlush(mov);
        em.clear();

        var recuperada = repository.findById(salva.getId()).orElseThrow();
        assertThat(recuperada.getId()).isEqualTo(salva.getId());
        assertThat(recuperada.getEmpresa().getId()).isEqualTo(empresa.getId());
        assertThat(recuperada.getProduto().getId()).isEqualTo(produto.getId());
        assertThat(recuperada.getUsuario().getId()).isEqualTo(usuario.getId());
        assertThat(recuperada.getTipo()).isEqualTo(TipoMovimentacaoEstoque.ENTRADA);
        assertThat(recuperada.getOrigem()).isEqualTo(OrigemMovimentacaoEstoque.MANUAL);
        assertThat(recuperada.getQuantidade()).isEqualByComparingTo("50.000");
        assertThat(recuperada.getSaldoAnterior()).isEqualByComparingTo("100.000");
        assertThat(recuperada.getSaldoPosterior()).isEqualByComparingTo("150.000");
        assertThat(recuperada.getMotivo()).isEqualTo("Entrada manual de estoque");
        assertThat(recuperada.getDataHora()).isNotNull();
    }

    @Test void devePersistirBigDecimalComEscalaCorreta() {
        var empresa = criarEmpresa();
        var usuario = criarUsuario(empresa);
        var produto = criarProduto(empresa);

        var mov = new MovimentacaoEstoqueEntity();
        mov.setEmpresa(empresa);
        mov.setProduto(produto);
        mov.setUsuario(usuario);
        mov.setTipo(TipoMovimentacaoEstoque.SAIDA);
        mov.setOrigem(OrigemMovimentacaoEstoque.VENDA);
        mov.setQuantidade(new java.math.BigDecimal("12.345"));
        mov.setSaldoAnterior(new java.math.BigDecimal("100.000"));
        mov.setSaldoPosterior(new java.math.BigDecimal("87.655"));

        var salva = repository.saveAndFlush(mov);
        em.clear();

        var recuperada = repository.findById(salva.getId()).orElseThrow();
        assertThat(recuperada.getQuantidade()).isEqualByComparingTo("12.345");
        assertThat(recuperada.getSaldoAnterior()).isEqualByComparingTo("100.000");
        assertThat(recuperada.getSaldoPosterior()).isEqualByComparingTo("87.655");
    }

    @Test void devePersistirEnumsCorretamente() {
        var empresa = criarEmpresa();
        var usuario = criarUsuario(empresa);
        var produto = criarProduto(empresa);

        var mov = new MovimentacaoEstoqueEntity();
        mov.setEmpresa(empresa);
        mov.setProduto(produto);
        mov.setUsuario(usuario);
        mov.setTipo(TipoMovimentacaoEstoque.AJUSTE);
        mov.setOrigem(OrigemMovimentacaoEstoque.AJUSTE);
        mov.setQuantidade(new java.math.BigDecimal("5.000"));
        mov.setSaldoAnterior(new java.math.BigDecimal("100.000"));
        mov.setSaldoPosterior(new java.math.BigDecimal("105.000"));

        var salva = repository.saveAndFlush(mov);
        em.clear();

        var recuperada = repository.findById(salva.getId()).orElseThrow();
        assertThat(recuperada.getTipo()).isEqualTo(TipoMovimentacaoEstoque.AJUSTE);
        assertThat(recuperada.getOrigem()).isEqualTo(OrigemMovimentacaoEstoque.AJUSTE);
    }

    @Test void devePersistirDataHoraAutomaticamente() {
        var empresa = criarEmpresa();
        var usuario = criarUsuario(empresa);
        var produto = criarProduto(empresa);

        var mov = new MovimentacaoEstoqueEntity();
        mov.setEmpresa(empresa);
        mov.setProduto(produto);
        mov.setUsuario(usuario);
        mov.setTipo(TipoMovimentacaoEstoque.ENTRADA);
        mov.setOrigem(OrigemMovimentacaoEstoque.MANUAL);
        mov.setQuantidade(new java.math.BigDecimal("10.000"));
        mov.setSaldoAnterior(new java.math.BigDecimal("100.000"));
        mov.setSaldoPosterior(new java.math.BigDecimal("110.000"));

        var antes = java.time.LocalDateTime.now();
        var salva = repository.saveAndFlush(mov);
        var depois = java.time.LocalDateTime.now();

        assertThat(salva.getDataHora()).isNotNull();
        assertThat(salva.getDataHora()).isAfterOrEqualTo(antes);
        assertThat(salva.getDataHora()).isBeforeOrEqualTo(depois);
    }

    @Test void deveConsultarIsoladoPorEmpresaEProduto() {
        var empresa1 = criarEmpresa();
        var empresa2 = criarEmpresa2();
        var usuario = criarUsuario(empresa1);
        var produto1 = criarProduto(empresa1);
        var produto2 = criarProduto(empresa2);

        var mov1 = new MovimentacaoEstoqueEntity();
        mov1.setEmpresa(empresa1);
        mov1.setProduto(produto1);
        mov1.setUsuario(usuario);
        mov1.setTipo(TipoMovimentacaoEstoque.ENTRADA);
        mov1.setOrigem(OrigemMovimentacaoEstoque.MANUAL);
        mov1.setQuantidade(new java.math.BigDecimal("10.000"));
        mov1.setSaldoAnterior(new java.math.BigDecimal("100.000"));
        mov1.setSaldoPosterior(new java.math.BigDecimal("110.000"));
        repository.saveAndFlush(mov1);

        var mov2 = new MovimentacaoEstoqueEntity();
        mov2.setEmpresa(empresa2);
        mov2.setProduto(produto2);
        mov2.setUsuario(usuario);
        mov2.setTipo(TipoMovimentacaoEstoque.ENTRADA);
        mov2.setOrigem(OrigemMovimentacaoEstoque.MANUAL);
        mov2.setQuantidade(new java.math.BigDecimal("20.000"));
        mov2.setSaldoAnterior(new java.math.BigDecimal("50.000"));
        mov2.setSaldoPosterior(new java.math.BigDecimal("70.000"));
        repository.saveAndFlush(mov2);

        em.clear();

        var listaEmpresa1 = repository.findByEmpresaIdAndProdutoIdOrderByDataHoraDesc(empresa1.getId(), produto1.getId());
        assertThat(listaEmpresa1).hasSize(1);
        assertThat(listaEmpresa1.get(0).getEmpresa().getId()).isEqualTo(empresa1.getId());
        assertThat(listaEmpresa1.get(0).getProduto().getId()).isEqualTo(produto1.getId());

        var listaEmpresa2 = repository.findByEmpresaIdAndProdutoIdOrderByDataHoraDesc(empresa2.getId(), produto2.getId());
        assertThat(listaEmpresa2).hasSize(1);
        assertThat(listaEmpresa2.get(0).getEmpresa().getId()).isEqualTo(empresa2.getId());
        assertThat(listaEmpresa2.get(0).getProduto().getId()).isEqualTo(produto2.getId());
    }

    @Test void deveManterHistoricoIndependenteDoSaldoAtualDoProduto() {
        var empresa = criarEmpresa();
        var usuario = criarUsuario(empresa);
        var produto = criarProduto(empresa);

        var mov1 = new MovimentacaoEstoqueEntity();
        mov1.setEmpresa(empresa);
        mov1.setProduto(produto);
        mov1.setUsuario(usuario);
        mov1.setTipo(TipoMovimentacaoEstoque.ENTRADA);
        mov1.setOrigem(OrigemMovimentacaoEstoque.MANUAL);
        mov1.setQuantidade(new java.math.BigDecimal("50.000"));
        mov1.setSaldoAnterior(new java.math.BigDecimal("100.000"));
        mov1.setSaldoPosterior(new java.math.BigDecimal("150.000"));
        repository.saveAndFlush(mov1);

        var mov2 = new MovimentacaoEstoqueEntity();
        mov2.setEmpresa(empresa);
        mov2.setProduto(produto);
        mov2.setUsuario(usuario);
        mov2.setTipo(TipoMovimentacaoEstoque.SAIDA);
        mov2.setOrigem(OrigemMovimentacaoEstoque.VENDA);
        mov2.setQuantidade(new java.math.BigDecimal("30.000"));
        mov2.setSaldoAnterior(new java.math.BigDecimal("150.000"));
        mov2.setSaldoPosterior(new java.math.BigDecimal("120.000"));
        repository.saveAndFlush(mov2);

        em.clear();

        var historico = repository.findByEmpresaIdAndProdutoIdOrderByDataHoraDesc(empresa.getId(), produto.getId());
        assertThat(historico).hasSize(2);
        assertThat(historico.get(0).getSaldoPosterior()).isEqualByComparingTo("120.000");
        assertThat(historico.get(1).getSaldoPosterior()).isEqualByComparingTo("150.000");
    }
}