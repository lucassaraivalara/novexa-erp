package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.service.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:contas-pagar;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa", "spring.datasource.password=", "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false",
        "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=60000"
})
@AutoConfigureMockMvc
@Transactional
class ContaPagarHttpTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired FornecedorRepository fornecedores;
    @Autowired ContaPagarRepository contas;
    @Autowired JwtService jwt;
    EmpresaEntity empresaA, empresaB;
    FornecedorEntity fornecedorA, fornecedorB;
    String tokenA, tokenB;

    @BeforeEach void preparar() {
        empresaA = empresa("A"); empresaB = empresa("B");
        fornecedorA = fornecedor(empresaA); fornecedorB = fornecedor(empresaB);
        tokenA = "Bearer " + jwt.gerarToken(usuario(empresaA, "02360684663"));
        tokenB = "Bearer " + jwt.gerarToken(usuario(empresaB, "52998224725"));
    }

    @Test void criaEListaSomenteDaEmpresaDoJwt() throws Exception {
        long id = criar(tokenA, fornecedorA.getId());
        mvc.perform(get("/financeiro/contas-pagar").header("Authorization", tokenA))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(id))
                .andExpect(jsonPath("$[0].fornecedorNome").value("Fornecedor"))
                .andExpect(jsonPath("$[0].status").value("ABERTA"))
                .andExpect(jsonPath("$[0].dataPagamento").doesNotExist());
        mvc.perform(get("/financeiro/contas-pagar").header("Authorization", tokenB))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        assertThat(contas.findById(id).orElseThrow().getEmpresa().getId()).isEqualTo(empresaA.getId());
    }

    @Test void editaAbertaEPreservaTenantMesmoComEmpresaForjada() throws Exception {
        long id = criar(tokenA, null);
        mvc.perform(put("/financeiro/contas-pagar/" + id).header("Authorization", tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of("descricao", "Aluguel atualizado", "documento", "NF-42",
                                "dataVencimento", "2026-11-10", "valor", 230.50, "categoria", "Ocupação",
                                "empresaId", empresaB.getId()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.descricao").value("Aluguel atualizado"))
                .andExpect(jsonPath("$.documento").value("NF-42"))
                .andExpect(jsonPath("$.valor").value(230.50));
        assertThat(contas.findById(id).orElseThrow().getEmpresa().getId()).isEqualTo(empresaA.getId());
    }

    @Test void pagamentoEEstornoLimpamOsDadosDaBaixa() throws Exception {
        long id = criar(tokenA, null);
        mvc.perform(post("/financeiro/contas-pagar/" + id + "/pagar").header("Authorization", tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dataPagamento\":\"2026-10-01\",\"valorPago\":200}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PAGA"))
                .andExpect(jsonPath("$.dataPagamento").value("2026-10-01"))
                .andExpect(jsonPath("$.valorPago").value(200));
        mvc.perform(put("/financeiro/contas-pagar/" + id).header("Authorization", tokenA)
                        .contentType(MediaType.APPLICATION_JSON).content(pedido(null)))
                .andExpect(status().isConflict());
        mvc.perform(post("/financeiro/contas-pagar/" + id + "/estornar").header("Authorization", tokenA))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ABERTA"))
                .andExpect(jsonPath("$.dataPagamento").doesNotExist())
                .andExpect(jsonPath("$.valorPago").doesNotExist());
    }

    @Test void baixaExigeDataEValorIntegral() throws Exception {
        long id = criar(tokenA, null);
        mvc.perform(post("/financeiro/contas-pagar/" + id + "/pagar").header("Authorization", tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dataPagamento\":\"2026-10-01\",\"valorPago\":198.50}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/financeiro/contas-pagar/" + id + "/pagar").header("Authorization", tokenA)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"valorPago\":200}"))
                .andExpect(status().isBadRequest());
        assertThat(contas.findById(id).orElseThrow().getStatus()).isEqualTo(StatusContaPagar.ABERTA);
    }

    @Test void cancelaAbertaEBloqueiaNovasTransicoes() throws Exception {
        long id = criar(tokenA, null);
        mvc.perform(post("/financeiro/contas-pagar/" + id + "/cancelar").header("Authorization", tokenA))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELADA"));
        mvc.perform(post("/financeiro/contas-pagar/" + id + "/pagar").header("Authorization", tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dataPagamento\":\"2026-10-01\",\"valorPago\":200}"))
                .andExpect(status().isConflict());
        mvc.perform(post("/financeiro/contas-pagar/" + id + "/estornar").header("Authorization", tokenA))
                .andExpect(status().isConflict());
    }

    @Test void bloqueiaContaEFornecedorDaOutraEmpresa() throws Exception {
        long id = criar(tokenA, fornecedorA.getId());
        mvc.perform(post("/financeiro/contas-pagar").header("Authorization", tokenA)
                        .contentType(MediaType.APPLICATION_JSON).content(pedido(fornecedorB.getId())))
                .andExpect(status().isNotFound());
        mvc.perform(put("/financeiro/contas-pagar/" + id).header("Authorization", tokenA)
                        .contentType(MediaType.APPLICATION_JSON).content(pedido(fornecedorB.getId())))
                .andExpect(status().isNotFound());
        mvc.perform(put("/financeiro/contas-pagar/" + id).header("Authorization", tokenB)
                        .contentType(MediaType.APPLICATION_JSON).content(pedido(null)))
                .andExpect(status().isNotFound());
        for (String acao : new String[]{"pagar", "cancelar", "estornar"})
            mvc.perform(post("/financeiro/contas-pagar/" + id + "/" + acao).header("Authorization", tokenB)
                            .contentType(MediaType.APPLICATION_JSON).content(acao.equals("pagar")
                                    ? "{\"dataPagamento\":\"2026-10-01\",\"valorPago\":200}" : "{}"))
                    .andExpect(status().isNotFound());
        assertThat(contas.findById(id).orElseThrow().getStatus()).isEqualTo(StatusContaPagar.ABERTA);
    }

    @Test void validaCamposObrigatoriosEAutenticacao() throws Exception {
        mvc.perform(post("/financeiro/contas-pagar").header("Authorization", tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"descricao\":\" \",\"dataVencimento\":\"2026-10-10\",\"valor\":0}"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/financeiro/contas-pagar")).andExpect(status().isUnauthorized());
    }

    private long criar(String token, Long fornecedorId) throws Exception {
        var resposta = mvc.perform(post("/financeiro/contas-pagar").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content(pedido(fornecedorId)))
                .andExpect(status().isCreated()).andReturn();
        return json.readTree(resposta.getResponse().getContentAsString()).get("id").asLong();
    }

    private String pedido(Long fornecedorId) throws Exception {
        var dados = new java.util.HashMap<String, Object>();
        dados.put("descricao", "Aluguel"); dados.put("dataVencimento", "2026-10-10"); dados.put("valor", 200);
        dados.put("empresaId", empresaB.getId());
        if (fornecedorId != null) dados.put("fornecedorId", fornecedorId);
        return json.writeValueAsString(dados);
    }

    private EmpresaEntity empresa(String nome) {
        var empresa = new EmpresaEntity(); empresa.setRazaoSocial(nome); empresa.setAtivo(true);
        return empresas.saveAndFlush(empresa);
    }

    private UsuarioEntity usuario(EmpresaEntity empresa, String cpf) {
        var usuario = new UsuarioEntity(); usuario.setEmpresa(empresa); usuario.setCpf(cpf);
        usuario.setNomeUsuario("Administrador"); usuario.setSenha("hash"); usuario.setAtivo(true);
        usuario.setPerfil(PerfilUsuario.ADMIN); return usuarios.saveAndFlush(usuario);
    }

    private FornecedorEntity fornecedor(EmpresaEntity empresa) {
        var fornecedor = new FornecedorEntity(); fornecedor.setEmpresa(empresa); fornecedor.setRazaoSocial("Fornecedor");
        return fornecedores.saveAndFlush(fornecedor);
    }
}
