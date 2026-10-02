package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.service.JwtService;
import br.com.novexa.erp.support.AutenticacaoTeste;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:fornecedor-http;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa", "spring.datasource.password=", "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false", "spring.jpa.show-sql=false",
        "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=60000",
        "supabase.url=https://storage.test", "supabase.secret-key=synthetic-test-key", "supabase.bucket=produtos"
})
@AutoConfigureMockMvc
@Transactional
class FornecedorHttpTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired FornecedorRepository fornecedores;
    @Autowired EmpresaRepository empresas;
    @Autowired UsuarioRepository usuarios;
    @Autowired JwtService jwt;
    EmpresaEntity empresaA;
    EmpresaEntity empresaB;
    String authorization;

    @BeforeEach void preparar() {
        empresaA = empresa("Empresa A"); empresaB = empresa("Empresa B");
        authorization = AutenticacaoTeste.token(usuarios, jwt, empresaA, PerfilUsuario.USUARIO, "02360684663");
    }

    private EmpresaEntity empresa(String nome) {
        var e = new EmpresaEntity(); e.setRazaoSocial(nome); e.setAtivo(true);
        return empresas.saveAndFlush(e);
    }

    ResultActions criar(Map<String, Object> dados) throws Exception {
        return mvc.perform(post("/fornecedores").header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dados)));
    }

    private long id(ResultActions resposta) throws Exception {
        return json.readTree(resposta.andReturn().getResponse().getContentAsString()).get("id").asLong();
    }

    private ResultActions editar(long id, Map<String, Object> dados) throws Exception {
        return mvc.perform(put("/fornecedores/" + id).header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dados)));
    }

    FornecedorEntity fornecedor(EmpresaEntity empresa, String nome, boolean ativo) {
        var f = new FornecedorEntity(); f.setEmpresa(empresa); f.setRazaoSocial(nome); f.setAtivo(ativo);
        return fornecedores.saveAndFlush(f);
    }

    @Test void cadastroMinimoAceitaAliasERetornaObjetoSelecionavel() throws Exception {
        long id = id(criar(Map.of("nomeRazaoSocial", "  ABC Distribuidora  "))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.razaoSocial").value("ABC Distribuidora"))
                .andExpect(jsonPath("$.ativo").value(true)).andExpect(jsonPath("$.cpfCnpj").isEmpty())
                .andExpect(jsonPath("$.tipoPessoa").isEmpty()).andExpect(jsonPath("$.dataCadastro").isNotEmpty())
                .andExpect(jsonPath("$.dataAtualizacao").isNotEmpty()));
        assertThat(fornecedores.findById(id).orElseThrow().getEmpresa().getId()).isEqualTo(empresaA.getId());
    }

    @Test void cadastroCompletoPreservaCamposEInferePessoaJuridica() throws Exception {
        var dados = new HashMap<String, Object>(Map.of("razaoSocial", "ABC Ltda", "nomeFantasia", "ABC",
                "cpfCnpj", "11.222.333/0001-81", "telefone", "(11) 3333-4444", "email", "abc@example.test",
                "cep", "01001-000", "logradouro", "Rua A", "numero", "10", "complemento", "Sala 2", "bairro", "Centro"));
        dados.putAll(Map.of("cidade", "Sao Paulo", "uf", "sp", "observacao", "Entrega pela manha",
                "inscricaoEstadual", "ISENTO", "endereco", "Endereco legado"));
        criar(dados).andExpect(status().isCreated()).andExpect(jsonPath("$.nomeFantasia").value("ABC"))
                .andExpect(jsonPath("$.cpfCnpj").value("11222333000181")).andExpect(jsonPath("$.tipoPessoa").value("JURIDICA"))
                .andExpect(jsonPath("$.telefone").value("(11) 3333-4444")).andExpect(jsonPath("$.email").value("abc@example.test"))
                .andExpect(jsonPath("$.cep").value("01001000")).andExpect(jsonPath("$.logradouro").value("Rua A"))
                .andExpect(jsonPath("$.numero").value("10")).andExpect(jsonPath("$.complemento").value("Sala 2"))
                .andExpect(jsonPath("$.bairro").value("Centro")).andExpect(jsonPath("$.cidade").value("Sao Paulo"))
                .andExpect(jsonPath("$.uf").value("SP")).andExpect(jsonPath("$.observacao").value("Entrega pela manha"))
                .andExpect(jsonPath("$.endereco").value("Endereco legado")).andExpect(jsonPath("$.inscricaoEstadual").value("ISENTO"));
    }

    @ParameterizedTest @CsvSource({"529.982.247-25,52998224725,FISICA", "11.222.333/0001-81,11222333000181,JURIDICA"})
    void documentoNormalizadoETipoInferido(String entrada, String normalizado, String tipo) throws Exception {
        criar(Map.of("razaoSocial", "Fornecedor", "cpfCnpj", " " + entrada + " ", "tipoPessoa", "INFORMACAO_IGNORADA"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.cpfCnpj").value(normalizado))
                .andExpect(jsonPath("$.tipoPessoa").value(tipo));
    }

    @Test void permiteVariosSemDocumentoENomesIguais() throws Exception {
        criar(Map.of("razaoSocial", "Mesmo nome")).andExpect(status().isCreated());
        criar(Map.of("razaoSocial", "Mesmo nome", "cpfCnpj", " ")).andExpect(status().isCreated());
        criar(Map.of("razaoSocial", "Mesmo nome", "cpfCnpj", "")).andExpect(status().isCreated());
        assertThat(fornecedores.findAll()).hasSize(3).allSatisfy(f -> assertThat(f.getCpfCnpj()).isNull());
    }

    @Test void documentoDuplicadoNoTenantInclusiveInativoRetorna409() throws Exception {
        long id = id(criar(Map.of("razaoSocial", "Primeiro", "cpfCnpj", "529.982.247-25")).andExpect(status().isCreated()));
        mvc.perform(delete("/fornecedores/" + id).header("Authorization", authorization)).andExpect(status().isNoContent());
        criar(Map.of("razaoSocial", "Segundo", "cpfCnpj", "52998224725")).andExpect(status().isConflict());
        assertThat(fornecedores.count()).isEqualTo(1);
    }

    @Test void documentoLegadoMascaradoContinuaBuscavelEDuplicidadeNaoTemFallback() throws Exception {
        var legado = fornecedor(empresaA, "Fornecedor legado", true);
        legado.setCpfCnpj("529.982.247-25"); fornecedores.saveAndFlush(legado);
        mvc.perform(get("/fornecedores/buscar").param("termo", "52998224725").header("Authorization", authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(legado.getId()));
        criar(Map.of("razaoSocial", "Outro", "cpfCnpj", "52998224725")).andExpect(status().isConflict());
        assertThat(fornecedores.findById(legado.getId()).orElseThrow().getCpfCnpj()).isEqualTo("529.982.247-25");
    }

    @Test void mesmoDocumentoEmOutraEmpresaPermitido() throws Exception {
        criar(Map.of("razaoSocial", "Fornecedor", "cpfCnpj", "52998224725")).andExpect(status().isCreated());
        authorization = AutenticacaoTeste.token(usuarios, jwt, empresaB, PerfilUsuario.USUARIO, "11144477735");
        criar(Map.of("razaoSocial", "Fornecedor", "cpfCnpj", "529.982.247-25"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.empresaId").value(empresaB.getId()));
        assertThat(fornecedores.count()).isEqualTo(2);
    }

    @Test void edicaoNaoTrocaTenantNemDataCadastroERejeitaDuplicidade() throws Exception {
        long a = id(criar(Map.of("razaoSocial", "Fornecedor A", "cpfCnpj", "52998224725")).andExpect(status().isCreated()));
        long b = id(criar(Map.of("razaoSocial", "Fornecedor B")).andExpect(status().isCreated()));
        var criacao = fornecedores.findById(b).orElseThrow().getDataCadastro();
        editar(b, Map.of("razaoSocial", "Tentativa", "cpfCnpj", "529.982.247-25")).andExpect(status().isConflict());
        editar(a, Map.of("razaoSocial", "Fornecedor A", "cpfCnpj", "52998224725")).andExpect(status().isOk());
        editar(b, Map.of("nomeRazaoSocial", "Regularizado", "empresaId", empresaB.getId(), "tenantId", empresaB.getId(),
                "cidade", "Cidade nova", "uf", "mg", "observacao", "Atualizado"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.empresaId").value(empresaA.getId()))
                .andExpect(jsonPath("$.cidade").value("Cidade nova")).andExpect(jsonPath("$.uf").value("MG"));
        var salvo = fornecedores.findById(b).orElseThrow();
        assertThat(salvo.getEmpresa().getId()).isEqualTo(empresaA.getId());
        assertThat(salvo.getDataCadastro()).isEqualTo(criacao);
        assertThat(salvo.getDataAtualizacao()).isAfterOrEqualTo(criacao);
    }

    @Test void inativacaoPreservaHistoricoERetryEReativacaoPeloPut() throws Exception {
        long id = id(criar(Map.of("razaoSocial", "Historico", "ativo", false)).andExpect(status().isCreated())
                .andExpect(jsonPath("$.ativo").value(true)));
        for (int i = 0; i < 2; i++)
            mvc.perform(delete("/fornecedores/" + id).header("Authorization", authorization)).andExpect(status().isNoContent());
        mvc.perform(get("/fornecedores/" + id).header("Authorization", authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ativo").value(false));
        editar(id, Map.of("razaoSocial", "Historico editado")).andExpect(status().isOk()).andExpect(jsonPath("$.ativo").value(false));
        mvc.perform(get("/fornecedores/buscar").header("Authorization", authorization)).andExpect(jsonPath("$.length()").value(0));
        editar(id, Map.of("razaoSocial", "Historico editado", "ativo", true)).andExpect(status().isOk());
        assertThat(fornecedores.count()).isEqualTo(1);
    }

    @ParameterizedTest @ValueSource(strings = {"aBc", "fANTASIA", "529.982.247-25", "52998224725"})
    void buscaAdministrativaEOperacionalPorNomeFantasiaEDocumento(String termo) throws Exception {
        long id = id(criar(Map.of("razaoSocial", "ABC Distribuidora", "nomeFantasia", "Fantasia",
                "cpfCnpj", "52998224725")).andExpect(status().isCreated()));
        fornecedor(empresaB, "ABC Distribuidora Fantasia", true);
        mvc.perform(get("/fornecedores").param("termo", termo).header("Authorization", authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].id").value(id));
        mvc.perform(get("/fornecedores/buscar").param("termo", termo).header("Authorization", authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value(id))
                .andExpect(jsonPath("$[0].email").doesNotExist()).andExpect(jsonPath("$[0].empresaId").doesNotExist());
    }

    @Test void paginaNoBancoComTotalFiltrosSortEDesempate() throws Exception {
        var a = fornecedor(empresaA, "A", true); var b1 = fornecedor(empresaA, "B", true);
        var b2 = fornecedor(empresaA, "B", false); fornecedor(empresaA, "C", true); fornecedor(empresaA, "Z", true);
        fornecedor(empresaB, "Outra empresa", true);
        mvc.perform(get("/fornecedores").header("Authorization", authorization))
                .andExpect(jsonPath("$.page").value(0)).andExpect(jsonPath("$.size").value(25))
                .andExpect(jsonPath("$.totalItems").value(5));
        mvc.perform(get("/fornecedores").param("size", "2").param("page", "0").header("Authorization", authorization))
                .andExpect(jsonPath("$.totalItems").value(5)).andExpect(jsonPath("$.totalPages").value(3))
                .andExpect(jsonPath("$.items[0].id").value(a.getId())).andExpect(jsonPath("$.items[1].id").value(b1.getId()));
        mvc.perform(get("/fornecedores").param("size", "2").param("page", "1").header("Authorization", authorization))
                .andExpect(jsonPath("$.page").value(1)).andExpect(jsonPath("$.items[0].id").value(b2.getId()));
        mvc.perform(get("/fornecedores").param("ativo", "false").header("Authorization", authorization))
                .andExpect(jsonPath("$.totalItems").value(1)).andExpect(jsonPath("$.items[0].id").value(b2.getId()));
        mvc.perform(get("/fornecedores").param("ativo", "true").param("termo", "B").header("Authorization", authorization))
                .andExpect(jsonPath("$.totalItems").value(1)).andExpect(jsonPath("$.items[0].id").value(b1.getId()));
        mvc.perform(get("/fornecedores").param("sort", "razaoSocial,desc").header("Authorization", authorization))
                .andExpect(jsonPath("$.items[0].razaoSocial").value("Z"))
                .andExpect(jsonPath("$.items[2].id").value(b1.getId())).andExpect(jsonPath("$.items[3].id").value(b2.getId()));
    }

    @Test void lookupLimitadoAtivoETenantComOrdemPrevisivel() throws Exception {
        for (int i = 0; i < 25; i++) fornecedor(empresaA, String.format("Fornecedor %02d", i), true);
        fornecedor(empresaA, "A inativo", false); fornecedor(empresaB, "A de outro tenant", true);
        mvc.perform(get("/fornecedores/buscar").header("Authorization", authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(20))
                .andExpect(jsonPath("$[0].razaoSocial").value("Fornecedor 00"))
                .andExpect(jsonPath("$[19].razaoSocial").value("Fornecedor 19"));
    }

    @ParameterizedTest @ValueSource(strings = {"GET", "PUT", "DELETE"})
    void outroTenantNaoConsultaEditaInativaOuReativa(String metodo) throws Exception {
        var outro = fornecedor(empresaB, "Historico de B", false);
        var request = request(org.springframework.http.HttpMethod.valueOf(metodo), "/fornecedores/" + outro.getId())
                .header("Authorization", authorization).param("empresaId", empresaB.getId().toString());
        if (metodo.equals("PUT")) request.contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(Map.of("razaoSocial", "Tentativa", "ativo", true, "empresaId", empresaB.getId())));
        mvc.perform(request).andExpect(status().isNotFound());
        var preservado = fornecedores.findById(outro.getId()).orElseThrow();
        assertThat(preservado.getRazaoSocial()).isEqualTo("Historico de B");
        assertThat(preservado.getAtivo()).isFalse();
        assertThat(preservado.getEmpresa().getId()).isEqualTo(empresaB.getId());
    }

    @Test void buscaNaoTrataWildcardComoFiltroGlobal() throws Exception {
        fornecedor(empresaA, "Sem porcentagem", true); var esperado = fornecedor(empresaA, "Oferta 10%", true);
        mvc.perform(get("/fornecedores").param("termo", "%").header("Authorization", authorization))
                .andExpect(jsonPath("$.totalItems").value(1)).andExpect(jsonPath("$.items[0].id").value(esperado.getId()));
    }

    @ParameterizedTest @ValueSource(strings = {"123", "111.111.111-11", "12.345.678/0001-90", "sem documento"})
    void documentoInvalidoRetorna400(String documento) throws Exception {
        criar(Map.of("razaoSocial", "Fornecedor", "cpfCnpj", documento)).andExpect(status().isBadRequest());
        assertThat(fornecedores.count()).isZero();
    }

    @ParameterizedTest @CsvSource({"email,invalido", "uf,ABC", "cep,123"})
    void camposOpcionaisInvalidosRetornam400(String campo, String valor) throws Exception {
        criar(Map.of("razaoSocial", "Fornecedor", campo, valor)).andExpect(status().isBadRequest());
    }

    @ParameterizedTest @ValueSource(strings = {"", "  "})
    void nomeObrigatorio(String nome) throws Exception {
        criar(Map.of("razaoSocial", nome)).andExpect(status().isBadRequest());
    }

    @Test void rejeitaNomeLongo() throws Exception {
        criar(Map.of("razaoSocial", "a".repeat(151))).andExpect(status().isBadRequest());
    }

    @ParameterizedTest @CsvSource({"page,-1", "size,0", "size,101", "sort,empresaId asc", "sort,razaoSocial invalid", "ativo,invalido"})
    void parametrosInvalidosNaoSaoCorrigidosSilenciosamente(String campo, String valor) throws Exception {
        mvc.perform(get("/fornecedores").param(campo, valor.replace(' ', ',')).header("Authorization", authorization))
                .andExpect(status().isBadRequest());
    }
}
