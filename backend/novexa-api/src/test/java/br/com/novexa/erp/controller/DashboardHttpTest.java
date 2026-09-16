package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.service.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:dashboard-resumo;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false",
        "spring.jpa.open-in-view=false",
        "spring.jpa.show-sql=false",
        "novexa.jwt.secret=01234567890123456789012345678901",
        "novexa.jwt.expiration-ms=60000"
})
@AutoConfigureMockMvc
@Transactional
class DashboardHttpTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired ClienteRepository clientes;
    @Autowired ProdutoRepository produtos;
    @Autowired VendaRepository vendas;
    @Autowired CaixaRepository caixas;
    @Autowired SessaoCaixaRepository sessoes;
    @Autowired MovimentacaoCaixaRepository movimentos;
    @Autowired JwtService jwt;

    @Test
    void retornaResumoOperacionalSomenteDaEmpresaAutenticada() throws Exception {
        EmpresaEntity empresa = empresa("Empresa A", "11222333000181");
        UsuarioEntity operador = usuario(empresa, "02360684663");
        EmpresaEntity outraEmpresa = empresa("Empresa B", "12345678000190");
        UsuarioEntity outroOperador = usuario(outraEmpresa, "52998224725");

        cliente(empresa, "Ativo", true);
        cliente(empresa, "Inativo", false);
        cliente(outraEmpresa, "Outro tenant", true);

        produto(empresa, "Baixo", true, true, "2", "2");
        produto(empresa, "Normal", true, true, "3", "2");
        produto(empresa, "Sem controle", true, false, "0", "2");
        produto(empresa, "Inativo", false, true, "0", "2");
        produto(outraEmpresa, "Baixo externo", true, true, "0", "2");

        LocalDateTime agora = LocalDateTime.now();
        venda(empresa, operador, StatusVenda.FATURADA, "100", agora.minusMinutes(2));
        venda(empresa, operador, StatusVenda.FATURADA, "50", agora.minusMinutes(1));
        venda(empresa, operador, StatusVenda.CANCELADA, "500", agora);
        venda(empresa, operador, StatusVenda.ABERTA, "90", agora);
        venda(empresa, operador, StatusVenda.FATURADA, "300", agora.minusDays(1));
        venda(outraEmpresa, outroOperador, StatusVenda.FATURADA, "700", agora);

        SessaoCaixaEntity primeira = sessao(empresa, operador, "Caixa principal", "100");
        SessaoCaixaEntity segunda = sessao(empresa, operador, "Caixa auxiliar", "50");
        SessaoCaixaEntity fechada = sessao(empresa, operador, "Caixa fechado", "30");
        fechada.fechar(operador, new BigDecimal("30"));
        sessoes.saveAndFlush(fechada);
        sessao(outraEmpresa, outroOperador, "Caixa externo", "999");

        movimento(primeira, operador, TipoMovimentacaoCaixa.SUPRIMENTO, "20");
        movimento(primeira, operador, TipoMovimentacaoCaixa.SANGRIA, "5");

        String authorization = "Bearer " + jwt.gerarToken(operador);
        mvc.perform(get("/dashboard/resumo").header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.faturamentoHoje").value(150.00))
                .andExpect(jsonPath("$.quantidadeVendasHoje").value(2))
                .andExpect(jsonPath("$.ticketMedioHoje").value(75.00))
                .andExpect(jsonPath("$.quantidadeProdutosEstoqueBaixo").value(1))
                .andExpect(jsonPath("$.quantidadeClientesAtivos").value(1))
                .andExpect(jsonPath("$.sessoesCaixaAbertas.length()").value(2))
                .andExpect(jsonPath("$.sessoesCaixaAbertas[0].sessaoId").value(primeira.getId()))
                .andExpect(jsonPath("$.sessoesCaixaAbertas[0].caixaId").value(primeira.getCaixa().getId()))
                .andExpect(jsonPath("$.sessoesCaixaAbertas[0].descricaoCaixa").value("Caixa principal"))
                .andExpect(jsonPath("$.sessoesCaixaAbertas[0].saldoInicial").value(100.00))
                .andExpect(jsonPath("$.sessoesCaixaAbertas[0].saldoEsperadoDinheiro").value(115.00))
                .andExpect(jsonPath("$.sessoesCaixaAbertas[1].sessaoId").value(segunda.getId()))
                .andExpect(jsonPath("$.sessoesCaixaAbertas[1].saldoEsperadoDinheiro").value(50.00));
    }

    @Test
    void retornaZerosSemVendasEExigeAutenticacao() throws Exception {
        EmpresaEntity empresa = empresa("Sem movimento", "99888777000166");
        UsuarioEntity operador = usuario(empresa, "11144477735");

        mvc.perform(get("/dashboard/resumo")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + jwt.gerarToken(operador)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.faturamentoHoje").value(0))
                .andExpect(jsonPath("$.quantidadeVendasHoje").value(0))
                .andExpect(jsonPath("$.ticketMedioHoje").value(0))
                .andExpect(jsonPath("$.quantidadeProdutosEstoqueBaixo").value(0))
                .andExpect(jsonPath("$.quantidadeClientesAtivos").value(0))
                .andExpect(jsonPath("$.sessoesCaixaAbertas").isEmpty());

        mvc.perform(get("/dashboard/resumo")).andExpect(status().isUnauthorized());
    }

    private void venda(EmpresaEntity empresa, UsuarioEntity usuario, StatusVenda status,
                       String total, LocalDateTime dataHora) {
        VendaEntity venda = new VendaEntity(usuario, null);
        BigDecimal valor = new BigDecimal(total);
        venda.setSubtotal(valor);
        venda.setDesconto(BigDecimal.ZERO);
        venda.setTotal(valor);
        venda.setStatus(status);
        venda = vendas.saveAndFlush(venda);
        jdbc.update("update vendas set data_hora = ? where id = ?", Timestamp.valueOf(dataHora), venda.getId());
    }

    private SessaoCaixaEntity sessao(EmpresaEntity empresa, UsuarioEntity usuario, String descricao, String saldo) {
        CaixaEntity caixa = new CaixaEntity();
        caixa.setEmpresa(empresa);
        caixa.setDescricao(descricao);
        return sessoes.saveAndFlush(new SessaoCaixaEntity(
                caixas.saveAndFlush(caixa), usuario, new BigDecimal(saldo)));
    }

    private void movimento(SessaoCaixaEntity sessao, UsuarioEntity usuario,
                           TipoMovimentacaoCaixa tipo, String valor) {
        movimentos.saveAndFlush(new MovimentacaoCaixaEntity(
                sessao, usuario, null, UUID.randomUUID(), tipo, new BigDecimal(valor), null));
    }

    private void produto(EmpresaEntity empresa, String nome, boolean ativo, boolean controla,
                         String atual, String minimo) {
        ProdutoEntity produto = new ProdutoEntity();
        produto.setEmpresa(empresa);
        produto.setNome(nome);
        produto.setUnidadeMedida("UN");
        produto.setPrecoVenda(BigDecimal.TEN);
        produto.setAtivo(ativo);
        produto.setControlaEstoque(controla);
        produto.setEstoqueAtual(new BigDecimal(atual));
        produto.setEstoqueMinimo(new BigDecimal(minimo));
        produtos.saveAndFlush(produto);
    }

    private void cliente(EmpresaEntity empresa, String nome, boolean ativo) {
        ClienteEntity cliente = new ClienteEntity();
        cliente.setEmpresa(empresa);
        cliente.setNome(nome);
        cliente.setTipoPessoa(TipoPessoa.FISICA);
        cliente.setAtivo(ativo);
        clientes.saveAndFlush(cliente);
    }

    private EmpresaEntity empresa(String nome, String cnpj) {
        EmpresaEntity empresa = new EmpresaEntity();
        empresa.setRazaoSocial(nome);
        empresa.setCnpj(cnpj);
        empresa.setAtivo(true);
        return empresas.saveAndFlush(empresa);
    }

    private UsuarioEntity usuario(EmpresaEntity empresa, String cpf) {
        UsuarioEntity usuario = new UsuarioEntity();
        usuario.setEmpresa(empresa);
        usuario.setCpf(cpf);
        usuario.setNomeUsuario("Operador");
        usuario.setSenha("hash de teste");
        usuario.setAtivo(true);
        usuario.setPerfil(PerfilUsuario.USUARIO);
        return usuarios.saveAndFlush(usuario);
    }
}
