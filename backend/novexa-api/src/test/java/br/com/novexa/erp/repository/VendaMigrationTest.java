package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.VendaEntity;
import br.com.novexa.erp.entity.UsuarioEntity;
import org.junit.jupiter.api.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;

import java.sql.*;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

// Por padrao usa H2. A propriedade abaixo aceita somente um banco descartavel fornecido para validacao.
class VendaMigrationTest {
    private Connection connection;
    private String url;
    private String usuario;
    private String schema;

    @BeforeEach
    void prepararSchemaIsolado() throws Exception {
        url = System.getProperty("novexa.test.vendas.jdbc-url", "jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE");
        usuario = System.getProperty("novexa.test.vendas.jdbc-user", "sa");
        connection = DriverManager.getConnection(url, usuario, "");
        schema = "vendas_teste_" + UUID.randomUUID().toString().replace("-", "");
        executar("CREATE SCHEMA " + schema);
        connection.setSchema(schema);
        migrar("V1__baseline_novexa.sql");
        migrar("V2__cria_movimentacoes_estoque.sql");
        migrar("V3__cria_vendas_e_lancamentos.sql");
        if (url.startsWith("jdbc:postgresql:")) migrar("V4__cria_caixas.sql");
        migrar("V5__ajusta_vendas_abertas.sql");
        executar("INSERT INTO empresas (id,razao_social,ativo) VALUES (1,'Empresa',true)");
        executar("INSERT INTO usuario (id,empresa_id,nome_usuario,ativo,perfil) VALUES (1,1,'Operador',true,'USUARIO')");
        executar("INSERT INTO produtos (id,empresa_id,nome,unidade_medida,preco_venda,estoque_atual,data_cadastro) VALUES (1,1,'Nome atual','UN',25,9,CURRENT_TIMESTAMP)");
        executar("INSERT INTO movimentacoes_estoque (id,empresa_id,produto_id,usuario_id,tipo,origem,quantidade,saldo_anterior,saldo_posterior,data_hora) VALUES (1,1,1,1,'SAIDA','VENDA',1,10,9,CURRENT_TIMESTAMP)");
        executar("INSERT INTO vendas (empresa_id,usuario_id,chave_requisicao,resumo_requisicao,data_hora,status,subtotal,desconto,total,forma_pagamento,valor_recebido,troco) VALUES (1,1,'" + UUID.randomUUID() + "','resumo',CURRENT_TIMESTAMP,'ABERTA',10,0,10,'DINHEIRO',10,0)");
        executar("INSERT INTO vendas (empresa_id,usuario_id,data_hora,status,subtotal,desconto,total) VALUES (1,1,CURRENT_TIMESTAMP,'ABERTA',14,0,14)");
        executar("INSERT INTO venda_itens (venda_id,ordem,produto_id,nome_produto,quantidade,preco_unitario,subtotal,movimentacao_estoque_id) VALUES (1,2,1,'Nome historico',1,10,10,1)");
        executar("INSERT INTO itens_venda (venda_id,produto_id,quantidade,preco_unitario,subtotal) VALUES (2,1,2,7,14)");
        executar("INSERT INTO lancamentos_financeiros (empresa_id,venda_id,forma_pagamento,situacao,valor,data_hora) VALUES (1,1,'DINHEIRO','RECEBIDO',10,CURRENT_TIMESTAMP)");
    }

    @AfterEach
    void fecharBancoDeTeste() throws Exception {
        if (connection != null) connection.close();
        // H2 desaparece ao fechar a conexao; PostgreSQL conserva o schema aleatorio para inspecao no cluster descartavel.
    }

    @Test
    void preservaDadosDosDoisFluxosEValidaModeloOficial() throws Exception {
        connection.setAutoCommit(false);
        migrar("V6__consolida_itens_e_faturamento.sql");
        connection.commit();
        assertThat(numero("SELECT count(*) FROM itens_venda")).isEqualTo(2);
        assertThat(numero("SELECT count(*) FROM venda_itens_legado_v6")).isEqualTo(1);
        assertThat(texto("SELECT status FROM vendas WHERE id=1")).isEqualTo("FATURADA");
        assertThat(texto("SELECT status FROM vendas WHERE id=2")).isEqualTo("ABERTA");
        assertThat(texto("SELECT nome_produto FROM itens_venda WHERE venda_id=1")).isEqualTo("Nome historico");
        assertThat(numero("SELECT preco_unitario FROM itens_venda WHERE venda_id=1")).isEqualTo(10);
        assertThat(numero("SELECT movimentacao_estoque_id FROM itens_venda WHERE venda_id=1")).isEqualTo(1);
        assertThat(numero("SELECT ordem FROM itens_venda WHERE venda_id=1")).isEqualTo(2);
        assertThat(numero("SELECT quantidade FROM itens_venda WHERE venda_id=2")).isEqualTo(2);
        assertThat(numero("SELECT preco_unitario FROM itens_venda WHERE venda_id=2")).isEqualTo(7);
        assertThat(numero("SELECT subtotal FROM itens_venda WHERE venda_id=2")).isEqualTo(14);
        assertThat(numero("SELECT estoque_atual FROM produtos WHERE id=1")).isEqualTo(9);
        assertThat(numero("SELECT count(*) FROM lancamentos_financeiros")).isEqualTo(1);
        if (url.startsWith("jdbc:postgresql:")) {
            migrar("V7__cria_pagamentos.sql");
            migrar("V8__cria_formas_pagamento.sql");
            connection.commit();
            validarHibernatePostgres();
        }
    }

    @Test
    void interrompeDadosAmbiguosSemRemoverOuMisturarItens() throws Exception {
        executar("INSERT INTO itens_venda (venda_id,produto_id,quantidade,preco_unitario,subtotal) VALUES (1,1,1,10,10)");
        connection.setAutoCommit(false);
        assertThatThrownBy(() -> migrar("V6__consolida_itens_e_faturamento.sql"))
                .hasMessageContaining("verificacao_consolidacao_venda");
        connection.rollback();
        assertThat(numero("SELECT count(*) FROM venda_itens")).isEqualTo(1);
        assertThat(numero("SELECT count(*) FROM itens_venda")).isEqualTo(2);
        assertThat(texto("SELECT status FROM vendas WHERE id=1")).isEqualTo("ABERTA");
    }

    private void validarHibernatePostgres() {
        var factory = new LocalContainerEntityManagerFactoryBean();
        factory.setDataSource(new DriverManagerDataSource(url, usuario, ""));
        factory.setPackagesToScan("br.com.novexa.erp.entity");
        factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        factory.setJpaPropertyMap(Map.of(
                "hibernate.hbm2ddl.auto", "validate",
                "hibernate.default_schema", schema,
                "hibernate.physical_naming_strategy", "org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy"));
        try {
            factory.afterPropertiesSet();
            try (var em = factory.getObject().createEntityManager()) {
                em.getTransaction().begin();
                var aberta = new VendaEntity(em.find(UsuarioEntity.class, 1L), null);
                em.persist(aberta);
                em.flush();
                assertThat(aberta.getTotal()).isEqualByComparingTo("0");
                em.getTransaction().rollback();
                var venda = em.find(VendaEntity.class, 1L);
                assertThat(venda.getItens()).singleElement().satisfies(item -> {
                    assertThat(item.getNomeProduto()).isEqualTo("Nome historico");
                    assertThat(item.getPrecoUnitario()).isEqualByComparingTo("10");
                    assertThat(item.getMovimentacaoEstoqueId()).isEqualTo(1L);
                });
            }
        } finally {
            factory.destroy();
        }
    }

    private void migrar(String arquivo) {
        ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/" + arquivo));
    }
    private void executar(String sql) throws SQLException {
        try (var statement = connection.createStatement()) { statement.execute(sql); }
    }
    private long numero(String sql) throws SQLException {
        try (var statement = connection.createStatement(); var result = statement.executeQuery(sql)) {
            assertThat(result.next()).isTrue();
            return result.getLong(1);
        }
    }
    private String texto(String sql) throws SQLException {
        try (var statement = connection.createStatement(); var result = statement.executeQuery(sql)) {
            assertThat(result.next()).isTrue();
            return result.getString(1);
        }
    }
}
