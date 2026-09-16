package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.service.JwtService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:venda-listagem;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
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
class VendaListagemHttpTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired ClienteRepository clientes;
    @Autowired VendaRepository vendas;
    @Autowired CaixaRepository caixas;
    @Autowired SessaoCaixaRepository sessoes;
    @Autowired JwtService jwt;

    EmpresaEntity empresa;
    EmpresaEntity outraEmpresa;
    UsuarioEntity operador;
    String authorization;

    @BeforeEach
    void preparar() {
        empresa = empresa("Empresa A", "11222333000181");
        outraEmpresa = empresa("Empresa B", "12345678000190");
        operador = usuario(empresa, "02360684663");
        authorization = "Bearer " + jwt.gerarToken(operador);
    }

    @AfterEach
    void limpar() {
        jdbc.update("delete from itens_venda");
        jdbc.update("delete from vendas");
        sessoes.deleteAllInBatch();
        caixas.deleteAllInBatch();
        clientes.deleteAll();
        usuarios.deleteAll();
        empresas.deleteAll();
    }

    @Test
    void listaSomenteVendasDaEmpresaAutenticadaEmResumoMaisRecentePrimeiro() throws Exception {
        ClienteEntity cliente = cliente(empresa, "Cliente A");
        SessaoCaixaEntity sessao = sessao(empresa, operador);
        long antiga = venda(empresa, operador, null, StatusVenda.ABERTA, "10.00",
                LocalDateTime.now().minusDays(2), null);
        long recente = venda(empresa, operador, cliente, StatusVenda.FATURADA, "30.00",
                LocalDateTime.now(), sessao);
        venda(outraEmpresa, usuario(outraEmpresa, "52998224725"), null, StatusVenda.FATURADA, "99.00",
                LocalDateTime.now().plusMinutes(1), null);

        mvc.perform(get("/vendas").header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(recente))
                .andExpect(jsonPath("$[0].clienteId").value(cliente.getId()))
                .andExpect(jsonPath("$[0].nomeCliente").value("Cliente A"))
                .andExpect(jsonPath("$[0].total").value(30.00))
                .andExpect(jsonPath("$[0].status").value("FATURADA"))
                .andExpect(jsonPath("$[0].sessaoCaixaId").value(sessao.getId()))
                .andExpect(jsonPath("$[0].itens").doesNotExist())
                .andExpect(jsonPath("$[1].id").value(antiga));
    }

    @Test
    void filtraPorStatusDataECliente() throws Exception {
        ClienteEntity cliente = cliente(empresa, "Cliente filtro");
        ClienteEntity outroCliente = cliente(empresa, "Outro cliente");
        LocalDate hoje = LocalDate.now();
        long esperado = venda(empresa, operador, cliente, StatusVenda.FATURADA, "20.00",
                hoje.atTime(10, 0), null);
        venda(empresa, operador, cliente, StatusVenda.ABERTA, "20.00",
                hoje.atTime(11, 0), null);
        venda(empresa, operador, outroCliente, StatusVenda.FATURADA, "25.00",
                hoje.atTime(12, 0), null);
        venda(empresa, operador, cliente, StatusVenda.FATURADA, "30.00",
                hoje.minusDays(1).atTime(10, 0), null);

        mvc.perform(get("/vendas")
                        .header(HttpHeaders.AUTHORIZATION, authorization)
                        .param("status", "FATURADA")
                        .param("dataInicial", hoje.toString())
                        .param("dataFinal", hoje.toString())
                        .param("clienteId", cliente.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(esperado))
                .andExpect(jsonPath("$[0].nomeCliente").value("Cliente filtro"));
    }

    @Test
    void listagemExigeAutenticacaoERejeitaIntervaloInvalido() throws Exception {
        mvc.perform(get("/vendas")).andExpect(status().isUnauthorized());

        mvc.perform(get("/vendas")
                        .header(HttpHeaders.AUTHORIZATION, authorization)
                        .param("dataInicial", LocalDate.now().toString())
                        .param("dataFinal", LocalDate.now().minusDays(1).toString()))
                .andExpect(status().isBadRequest());
    }

    private long venda(EmpresaEntity empresa, UsuarioEntity usuario, ClienteEntity cliente, StatusVenda status,
                       String total, LocalDateTime dataHora, SessaoCaixaEntity sessao) {
        VendaEntity venda = new VendaEntity(usuario, cliente);
        BigDecimal valor = new BigDecimal(total);
        venda.setSubtotal(valor);
        venda.setDesconto(BigDecimal.ZERO);
        venda.setTotal(valor);
        if (sessao != null) {
            venda.vincularSessaoCaixa(sessao);
        }
        venda.setStatus(status);
        VendaEntity salva = vendas.saveAndFlush(venda);
        jdbc.update("update vendas set data_hora = ? where id = ?", Timestamp.valueOf(dataHora), salva.getId());
        return salva.getId();
    }

    private SessaoCaixaEntity sessao(EmpresaEntity empresa, UsuarioEntity usuario) {
        CaixaEntity caixa = new CaixaEntity();
        caixa.setEmpresa(empresa);
        caixa.setDescricao("Caixa " + empresa.getId());
        return sessoes.saveAndFlush(new SessaoCaixaEntity(caixas.saveAndFlush(caixa), usuario, BigDecimal.ZERO));
    }

    private ClienteEntity cliente(EmpresaEntity empresa, String nome) {
        ClienteEntity cliente = new ClienteEntity();
        cliente.setEmpresa(empresa);
        cliente.setNome(nome);
        cliente.setTipoPessoa(TipoPessoa.FISICA);
        return clientes.saveAndFlush(cliente);
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
        usuario.setPerfil(PerfilUsuario.USUARIO);
        return usuarios.saveAndFlush(usuario);
    }
}
