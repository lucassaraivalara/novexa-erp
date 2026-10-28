package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.AjusteEstoqueLoteDTO.Item;
import br.com.novexa.erp.dto.AjusteEstoqueLoteDTO.Pedido;
import br.com.novexa.erp.dto.ImportacaoEstoqueDTO;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.mock.web.MockPart;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK, properties = {
    "spring.jpa.hibernate.ddl-auto=validate", "spring.flyway.enabled=true", "spring.jpa.open-in-view=false",
    "logging.level.root=ERROR", "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=600000"})
@EnabledIfSystemProperty(named="novexa.test.20b.jdbc-url",matches="jdbc:postgresql://127.0.0.1:.*")
@AutoConfigureMockMvc
class ImportacaoEstoquePostgresTest {
    private static final String SCHEMA = "importacao20c_" + UUID.randomUUID().toString().replace("-", "");
    private static final AtomicLong CPF = new AtomicLong(74000000000L);
    @DynamicPropertySource static void pg(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", () -> System.getProperty("novexa.test.20b.jdbc-url") + "?currentSchema=" + SCHEMA);
        p.add("spring.datasource.username", () -> "postgres"); p.add("spring.datasource.password", () -> "");
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.flyway.schemas", () -> SCHEMA); p.add("spring.flyway.default-schema", () -> SCHEMA);
    }
    @Autowired ImportacaoEstoqueService importacao;
    @Autowired AjusteEstoqueLoteService lotes;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired ProdutoRepository produtos;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;
    private EmpresaEntity empresa;
    private UsuarioEntity admin;
    private ProdutoEntity produto;
    private UsuarioAutenticado auth;

    @BeforeEach void preparar() {
        empresa = new EmpresaEntity(); empresa.setRazaoSocial("Empresa importacao 20C"); empresa.setCnpj(UUID.randomUUID().toString()); empresa.setAtivo(true); empresa = empresas.saveAndFlush(empresa);
        admin = new UsuarioEntity(); admin.setEmpresa(empresa); admin.setCpf(Long.toString(CPF.incrementAndGet())); admin.setNomeUsuario("Admin"); admin.setSenha("hash"); admin.setPerfil(PerfilUsuario.ADMIN); admin.setAtivo(true); admin = usuarios.saveAndFlush(admin);
        auth = new UsuarioAutenticado(admin.getId(), admin.getCpf(), empresa.getId(), PerfilUsuario.ADMIN);
        produto = new ProdutoEntity(); produto.setEmpresa(empresa); produto.setNome("Refrigerante"); produto.setCodigoInterno("001"); produto.setCodigoBarras("789001");
        produto.setUnidadeMedida("UN"); produto.setPrecoVenda(BigDecimal.TEN); produto.setEstoqueAtual(new BigDecimal("10")); produto.setControlaEstoque(true); produto.setAtivo(true); produto = produtos.saveAndFlush(produto);
    }

    @Test void previaCsvIdentificaCodigoInternoEBarcodeSemEscritaEConfirmaPela20B() {
        var r = previa("Código;Produto;Quantidade\n001;Refrigerante;15,125\n789001;Refrigerante;12\n");
        assertThat(r.totais().linhas()).isEqualTo(2); assertThat(r.totais().identificados()).isEqualTo(2);
        assertThat(r.totais().invalidos()).isEqualTo(2); assertThat(r.linhas()).allSatisfy(l -> assertThat(l.erros()).anyMatch(e -> e.contains("repetido")));
        assertThat(contar("movimentacoes_estoque")).isZero(); assertThat(contar("ajustes_estoque_lote")).isZero();

        r = previa("Código;Produto;Quantidade\n001;Refrigerante;15,125\n");
        assertThat(r.totais().validos()).isEqualTo(1); assertThat(r.linhas().getFirst().saldoAtual()).isEqualTo("10.000");
        var linha = r.lote().itens().getFirst();
        var pedido = new Pedido("SALDO_FINAL", "Contagem por planilha", UUID.randomUUID(), List.of(new Item(produto.getId(), new BigDecimal(r.linhas().getFirst().quantidade()), new BigDecimal(r.linhas().getFirst().saldoAtual()), linha.ultimaMovimentacaoId())));
        var confirmacao = lotes.confirmar(pedido, auth);
        assertThat(confirmacao.alterados()).isEqualTo(1); assertThat(saldo()).isEqualByComparingTo("15.125");
        assertThat(jdbc.queryForObject("select count(*) from movimentacoes_estoque where empresa_id=?", Long.class, empresa.getId())).isEqualTo(1);
    }

    @Test void codigoDeOutraEmpresaNaoEExpostoEProdutoInativoVemComoErroDa20B() {
        var outra = new EmpresaEntity(); outra.setRazaoSocial("Outra empresa"); outra.setCnpj(UUID.randomUUID().toString()); outra = empresas.saveAndFlush(outra);
        var fora = new ProdutoEntity(); fora.setEmpresa(outra); fora.setNome("Privado"); fora.setCodigoInterno("999"); fora.setUnidadeMedida("UN"); fora.setPrecoVenda(BigDecimal.ONE); fora.setControlaEstoque(true); fora.setAtivo(true); produtos.saveAndFlush(fora);
        produto.setAtivo(false); produto = produtos.saveAndFlush(produto);
        var r = previa("Código;Produto;Quantidade\n999;Privado;3\n001;Refrigerante;3\n");
        assertThat(r.linhas().get(0).produto()).isNull(); assertThat(r.linhas().get(0).erros()).anyMatch(e -> e.contains("não encontrado"));
        assertThat(r.linhas().get(1).erros()).anyMatch(e -> e.contains("inativo"));
        assertThat(contar("movimentacoes_estoque")).isZero();
    }

    @Test void permissaoAdminEValidadaTambemQuandoNenhumCodigoEReconhecido() {
        var gerente = new UsuarioAutenticado(admin.getId(), admin.getCpf(), empresa.getId(), PerfilUsuario.GERENTE);
        assertThatThrownBy(() -> importacao.previa(arquivo("Código;Produto;Quantidade\nxxx;Produto;1\n"), "Contagem", gerente))
                .hasMessageContaining("Somente ADMIN");
    }

    @Test void endpointMultipartUsaAutorizacaoAdminEContratoDePrevia() throws Exception {
        var file = new MockMultipartFile("arquivo", "contagem.csv", "text/csv", "Codigo;Produto;Quantidade\n001;Refrigerante;12,5\n".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        mvc.perform(multipart("/estoque/ajustes-lote/importacao/previa").file(file)
                .part(new MockPart("motivo", "Contagem HTTP".getBytes(java.nio.charset.StandardCharsets.UTF_8)))
                .header("Authorization", "Bearer " + jwt.gerarToken(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totais.validos").value(1))
                .andExpect(jsonPath("$.linhas[0].codigo").value("001"));
        var gerente = new UsuarioEntity(); gerente.setEmpresa(empresa); gerente.setCpf(Long.toString(CPF.incrementAndGet())); gerente.setNomeUsuario("Gerente");
        gerente.setSenha("hash"); gerente.setPerfil(PerfilUsuario.GERENTE); gerente.setAtivo(true); gerente = usuarios.saveAndFlush(gerente);
        mvc.perform(multipart("/estoque/ajustes-lote/importacao/previa").file(file)
                .part(new MockPart("motivo", "Contagem HTTP".getBytes(java.nio.charset.StandardCharsets.UTF_8)))
                .header("Authorization", "Bearer " + jwt.gerarToken(gerente))).andExpect(status().isForbidden());
        assertThat(contar("movimentacoes_estoque")).isZero();
    }

    private ImportacaoEstoqueDTO.Previa previa(String csv) { return importacao.previa(arquivo(csv), "Contagem física", auth); }
    private MockMultipartFile arquivo(String csv) { return new MockMultipartFile("arquivo", "estoque.csv", "text/csv", csv.getBytes(java.nio.charset.StandardCharsets.UTF_8)); }
    private long contar(String tabela) { return jdbc.queryForObject("select count(*) from " + tabela + " where empresa_id=?", Long.class, empresa.getId()); }
    private BigDecimal saldo() { return jdbc.queryForObject("select estoque_atual from produtos where id=?", BigDecimal.class, produto.getId()); }
}
