package br.com.novexa.erp.service;

import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.entity.ProdutoEntity;
import br.com.novexa.erp.repository.ProdutoAuditoriaRepository;
import br.com.novexa.erp.storage.ArquivoStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@DataJpaTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:auditoria1;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.open-in-view=false", "spring.jpa.show-sql=false",
        "spring.flyway.enabled=false"
})
@Import(ProdutoService.class)
@ActiveProfiles("test")
class ProdutoAuditoriaServiceTest {
    @org.springframework.test.context.bean.override.mockito.MockitoBean EmpresaService empresaService;
    @org.springframework.test.context.bean.override.mockito.MockitoBean ArquivoStorageService arquivoStorageService;
    @org.springframework.test.context.bean.override.mockito.MockitoBean ComposicaoProdutoService composicaoProdutoService;
    @Autowired ProdutoService produtoService;
    @Autowired ProdutoAuditoriaRepository auditoria;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void preparar() {
        jdbc.update("insert into empresas(id,razao_social,modo_recebimento_financeiro,modo_conferencia_fechamento,exigir_valores_informados_no_fechamento,permitir_venda_estoque_negativo) values (7001,'Auditoria','CONTROLADO','POR_FORMA_PAGAMENTO',true,false)");
        jdbc.update("insert into usuario(id,empresa_id,nome_usuario,perfil,ativo) values (7001,7001,'Operador Auditoria','ADMIN',true)");
        jdbc.update("insert into produtos(id,empresa_id,nome,unidade_medida,preco_custo,preco_venda,estoque_atual,estoque_minimo,controla_estoque,composto,composicao_versao,ativo,data_cadastro) values (7001,7001,'Produto Auditoria','UN',1,10,0,0,true,false,0,true,CURRENT_TIMESTAMP)");

        EmpresaEntity empresa = new EmpresaEntity();
        empresa.setId(7001L);
        empresa.setAtivo(true);
        when(empresaService.buscarPorId(7001L)).thenReturn(empresa);
    }

    private ProdutoEntity dadosAlterados(Boolean controlaEstoque, Boolean ativo) {
        ProdutoEntity dados = new ProdutoEntity();
        dados.setNome("Produto Auditoria");
        dados.setUnidadeMedida("UN");
        dados.setPrecoCusto(new BigDecimal("1.00"));
        dados.setPrecoVenda(new BigDecimal("10.00"));
        dados.setEstoqueMinimo(BigDecimal.ZERO);
        dados.setControlaEstoque(controlaEstoque);
        dados.setAtivo(ativo);
        return dados;
    }

    @Test
    void alteracoesCriticasGeramRegistroComAutoriaValoresEData() {
        produtoService.atualizar(7001L, dadosAlterados(false, false), 7001L, null, false, null, 7001L);

        var registros = auditoria.findByEmpresaIdAndProdutoIdOrderByDataHoraDescIdDesc(7001L, 7001L);
        assertThat(registros).hasSize(2);
        assertThat(registros).allSatisfy(r -> {
            assertThat(r.usuario.getId()).isEqualTo(7001L);
            assertThat(r.dataHora).isNotNull();
            assertThat(r.empresa.getId()).isEqualTo(7001L);
        });
        assertThat(registros).anySatisfy(r -> {
            assertThat(r.campo).isEqualTo("controla_estoque");
            assertThat(r.valorAnterior).isEqualTo("true");
            assertThat(r.valorNovo).isEqualTo("false");
        });
        assertThat(registros).anySatisfy(r -> {
            assertThat(r.campo).isEqualTo("ativo");
            assertThat(r.valorAnterior).isEqualTo("true");
            assertThat(r.valorNovo).isEqualTo("false");
        });
    }

    @Test
    void atualizacaoSemMudancaNaoGeraAuditoria() {
        produtoService.atualizar(7001L, dadosAlterados(true, true), 7001L, null, false, null, 7001L);

        assertThat(auditoria.findByEmpresaIdAndProdutoIdOrderByDataHoraDescIdDesc(7001L, 7001L)).isEmpty();
    }

    @Test
    void chamadaInternaSemUsuarioNaoGeraAuditoria() {
        produtoService.atualizar(7001L, dadosAlterados(false, false), 7001L, null, false, null);

        assertThat(auditoria.findByEmpresaIdAndProdutoIdOrderByDataHoraDescIdDesc(7001L, 7001L)).isEmpty();
        // O cadastro continua funcionando normalmente sem autoria de auditoria.
        assertThat(jdbc.queryForObject("select controla_estoque from produtos where id=7001", Boolean.class)).isFalse();
    }
}
