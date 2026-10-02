package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.entity.PerfilUsuario;
import br.com.novexa.erp.entity.UsuarioEntity;
import br.com.novexa.erp.repository.EmpresaRepository;
import br.com.novexa.erp.repository.UsuarioRepository;
import br.com.novexa.erp.service.JwtService;
import br.com.novexa.erp.service.UsuarioService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:usuario-isolamento;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.show-sql=false",
        "novexa.jwt.secret=01234567890123456789012345678901",
        "novexa.jwt.expiration-ms=60000"
})
@AutoConfigureMockMvc
@Transactional
class UsuarioIsolamentoTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private EmpresaRepository empresas;
    @Autowired private UsuarioRepository usuarios;
    @Autowired private UsuarioService usuarioService;
    @Autowired private JwtService jwtService;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private EntityManager entityManager;

    private EmpresaEntity empresaA;
    private EmpresaEntity empresaB;
    private UsuarioEntity usuarioA;
    private UsuarioEntity usuarioB;
    private String authorization;
    private long quantidadeInicial;

    @BeforeEach
    void preparar() {
        empresaA = empresa("Empresa A", "11222333000181");
        empresaB = empresa("Empresa B", "12345678000190");
        usuarioA = usuario(empresaA, "02360684663");
        usuarioB = usuario(empresaB, "52998224725");
        authorization = "Bearer " + jwtService.gerarToken(usuarioA);
        quantidadeInicial = usuarios.count();
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void listarSomenteUsuariosDaEmpresaAutenticada(boolean informarOutraEmpresa) throws Exception {
        var request = get("/usuarios").header(HttpHeaders.AUTHORIZATION, authorization);
        if (informarOutraEmpresa) request.param("empresaId", empresaB.getId().toString());

        mvc.perform(request).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(usuarioA.getId()))
                .andExpect(jsonPath("$[0].empresa.id").value(empresaA.getId()))
                .andExpect(jsonPath("$[0].senha").doesNotExist());
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void cadastrarNaEmpresaAutenticadaMesmoComEmpresaForjadaNoBody(boolean informarOutraEmpresa) throws Exception {
        Map<String, Object> dados = dados();
        if (informarOutraEmpresa) dados.put("empresaId", empresaB.getId());

        var resultado = mvc.perform(post("/usuarios").header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dados)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.empresa.id").value(empresaA.getId()))
                .andExpect(jsonPath("$.senha").doesNotExist())
                .andReturn();

        Long id = json.readTree(resultado.getResponse().getContentAsString()).get("id").asLong();
        entityManager.flush();
        entityManager.clear();
        UsuarioEntity salvo = usuarios.findById(id).orElseThrow();
        assertThat(salvo.getEmpresa().getId()).isEqualTo(empresaA.getId());
        assertThat(passwordEncoder.matches("novaSenha123", salvo.getSenha())).isTrue();
        assertThat(usuarios.findAllByEmpresaId(empresaB.getId())).hasSize(1);
    }

    @ParameterizedTest
    @CsvSource({"GET,false", "GET,true", "PUT,false", "PUT,true", "DELETE,false", "DELETE,true"})
    void naoPermitirAcessoOuAlteracaoDeUsuarioDaOutraEmpresa(String metodo, boolean informarOutraEmpresa) throws Exception {
        String senhaAnterior = usuarioB.getSenha();
        var request = request(HttpMethod.valueOf(metodo), "/usuarios/" + usuarioB.getId())
                .header(HttpHeaders.AUTHORIZATION, authorization);
        Map<String, Object> dados = dados();
        if (informarOutraEmpresa) {
            request.param("empresaId", empresaB.getId().toString());
            dados.put("empresaId", empresaB.getId());
        }
        if (metodo.equals("PUT")) {
            request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dados));
        }

        mvc.perform(request).andExpect(status().isNotFound())
                .andExpect(content().string("Usuário não encontrado."));

        entityManager.flush();
        entityManager.clear();
        UsuarioEntity preservado = usuarios.findById(usuarioB.getId()).orElseThrow();
        assertThat(preservado.getNomeUsuario()).isEqualTo("Usuário de teste");
        assertThat(preservado.getAtivo()).isTrue();
        assertThat(preservado.getCpf()).isEqualTo("52998224725");
        assertThat(preservado.getSenha()).isEqualTo(senhaAnterior);
        assertThat(preservado.getEmpresa().getId()).isEqualTo(empresaB.getId());
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void consultarAtualizarEExcluirUsuarioDaPropriaEmpresa(boolean informarOutraEmpresa) throws Exception {
        // Mantém o ator autenticado e opera sobre outro usuário da mesma empresa.
        UsuarioEntity alvo = usuario(empresaA, "11144477735");
        String url = "/usuarios/" + alvo.getId();
        mvc.perform(get(url).header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(alvo.getId()));

        Map<String, Object> dados = dados();
        if (informarOutraEmpresa) dados.put("empresaId", empresaB.getId());
        mvc.perform(put(url).header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dados)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nomeUsuario").value("Usuário alterado"))
                .andExpect(jsonPath("$.empresa.id").value(empresaA.getId()))
                .andExpect(jsonPath("$.senha").doesNotExist());

        entityManager.flush();
        entityManager.clear();
        UsuarioEntity salvo = usuarios.findById(alvo.getId()).orElseThrow();
        assertThat(salvo.getEmpresa().getId()).isEqualTo(empresaA.getId());
        assertThat(passwordEncoder.matches("novaSenha123", salvo.getSenha())).isTrue();

        mvc.perform(delete(url).header(HttpHeaders.AUTHORIZATION, authorization))
                .andExpect(status().isOk());
        entityManager.flush();
        entityManager.clear();
        assertThat(usuarios.findById(alvo.getId()).orElseThrow().getAtivo()).isFalse();
        assertThat(usuarios.findById(usuarioB.getId())).isPresent();
    }

    @Test
    void atualizarUsuarioSemSenhaPreservaSenhaAtual() throws Exception {
        UsuarioEntity alvo = usuario(empresaA, "11144477735");
        String senhaAnterior = alvo.getSenha();

        Map<String, Object> dados = new HashMap<>();
        dados.put("nomeUsuario", "Usuário sem troca de senha");
        dados.put("cpf", alvo.getCpf());
        dados.put("email", "sem-senha@novexa.com");
        dados.put("perfil", "GERENTE");
        dados.put("ativo", true);

        mvc.perform(put("/usuarios/" + alvo.getId()).header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dados)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nomeUsuario").value("Usuário sem troca de senha"))
                .andExpect(jsonPath("$.perfil").value("GERENTE"))
                .andExpect(jsonPath("$.senha").doesNotExist());

        entityManager.flush();
        entityManager.clear();
        UsuarioEntity salvo = usuarios.findById(alvo.getId()).orElseThrow();
        assertThat(salvo.getSenha()).isEqualTo(senhaAnterior);
    }

    @Test
    void redefinirSenhaAlteraSomenteASenha() throws Exception {
        UsuarioEntity alvo = usuario(empresaA, "11144477735");
        String senhaAnterior = alvo.getSenha();

        mvc.perform(patch("/usuarios/" + alvo.getId() + "/senha").header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("senha", "novaSenha456"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(alvo.getId()))
                .andExpect(jsonPath("$.senha").doesNotExist());

        entityManager.flush();
        entityManager.clear();
        UsuarioEntity salvo = usuarios.findById(alvo.getId()).orElseThrow();
        assertThat(salvo.getSenha()).isNotEqualTo(senhaAnterior);
        assertThat(passwordEncoder.matches("novaSenha456", salvo.getSenha())).isTrue();
        assertThat(salvo.getNomeUsuario()).isEqualTo(alvo.getNomeUsuario());
        assertThat(salvo.getPerfil()).isEqualTo(alvo.getPerfil());
    }

    @Test
    void alterarSituacaoSemPayloadCompletoPreservaDadosESenha() throws Exception {
        UsuarioEntity alvo = usuario(empresaA, "11144477735");
        String senhaAnterior = alvo.getSenha();

        mvc.perform(patch("/usuarios/" + alvo.getId() + "/situacao").header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("ativo", false))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ativo").value(false))
                .andExpect(jsonPath("$.senha").doesNotExist());

        entityManager.flush();
        entityManager.clear();
        UsuarioEntity salvo = usuarios.findById(alvo.getId()).orElseThrow();
        assertThat(salvo.getAtivo()).isFalse();
        assertThat(salvo.getSenha()).isEqualTo(senhaAnterior);
        assertThat(salvo.getCpf()).isEqualTo(alvo.getCpf());
    }

    @Test
    void naoPermiteInativarProprioUsuarioConectado() throws Exception {
        mvc.perform(patch("/usuarios/" + usuarioA.getId() + "/situacao").header(HttpHeaders.AUTHORIZATION, authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("ativo", false))))
                .andExpect(status().isConflict());

        entityManager.flush();
        entityManager.clear();
        assertThat(usuarios.findById(usuarioA.getId()).orElseThrow().getAtivo()).isTrue();
    }

    @Test
    void naoPermiteAlterarSituacaoOuSenhaDeUsuarioDaOutraEmpresa() throws Exception {
        String senhaAnterior = usuarioB.getSenha();
        for (String sufixo : new String[]{"/situacao", "/senha"}) {
            Map<String, Object> dados = sufixo.equals("/situacao") ? Map.of("ativo", false) : Map.of("senha", "novaSenha456");
            mvc.perform(patch("/usuarios/" + usuarioB.getId() + sufixo).header(HttpHeaders.AUTHORIZATION, authorization)
                            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dados)))
                    .andExpect(status().isNotFound());
        }

        entityManager.flush();
        entityManager.clear();
        UsuarioEntity preservado = usuarios.findById(usuarioB.getId()).orElseThrow();
        assertThat(preservado.getAtivo()).isTrue();
        assertThat(preservado.getSenha()).isEqualTo(senhaAnterior);
    }

    @ParameterizedTest
    @CsvSource({"GET,/usuarios", "GET,/usuarios/1", "POST,/usuarios", "PUT,/usuarios/1", "DELETE,/usuarios/1"})
    void todosOsEndpointsExigemAutenticacao(String metodo, String url) throws Exception {
        mvc.perform(request(HttpMethod.valueOf(metodo), url)).andExpect(status().isUnauthorized());
        assertThat(usuarios.count()).isEqualTo(quantidadeInicial);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void preservarUnicidadeGlobalDoCpfNoCadastroEAtualizacao(boolean atualizar) {
        UsuarioEntity dados = new UsuarioEntity();
        dados.setNomeUsuario("Usuário alterado");
        dados.setCpf(usuarioB.getCpf());
        dados.setSenha("novaSenha123");

        if (atualizar) {
            assertThatThrownBy(() -> usuarioService.atualizar(usuarioA.getId(), dados, empresaA.getId()))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("409 CONFLICT");
        } else {
            assertThatThrownBy(() -> usuarioService.salvar(dados, empresaA.getId()))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("409 CONFLICT");
        }
        assertThat(usuarios.count()).isEqualTo(quantidadeInicial);
        assertThat(usuarios.findById(usuarioA.getId()).orElseThrow().getCpf()).isEqualTo("02360684663");
    }

    private Map<String, Object> dados() {
        return new HashMap<>(Map.of("nomeUsuario", "Usuário alterado", "cpf", "11144477735",
                "email", "novo@novexa.com", "senha", "novaSenha123", "perfil", "USUARIO"));
    }
    @ParameterizedTest @ValueSource(strings = {"usuario", "empresa", "perfil", "vinculo", "excluido"})
    void jwtAnteriorNaoOperaAposMudancaDeAcesso(String caso) throws Exception {
        switch (caso) {
            case "usuario" -> usuarioA.setAtivo(false);
            case "empresa" -> empresaA.setAtivo(false);
            case "perfil" -> usuarioA.setPerfil(PerfilUsuario.OPERADOR);
            case "vinculo" -> usuarioA.setEmpresa(empresaB);
            case "excluido" -> usuarios.delete(usuarioA);
        }
        entityManager.flush(); entityManager.clear();
        mvc.perform(get("/clientes").header(HttpHeaders.AUTHORIZATION, authorization)).andExpect(status().isUnauthorized());
    }
    @ParameterizedTest @ValueSource(strings = {"nome", "cpf", "email", "semSenha", "senhaLonga"})
    void cadastroInvalidoRetorna400SemUsuarioParcial(String caso) throws Exception {
        var p = dados();
        switch (caso) {
            case "nome" -> p.put("nomeUsuario", " ");
            case "cpf" -> p.put("cpf", "11111111111");
            case "email" -> p.put("email", "invalido");
            case "semSenha" -> p.remove("senha");
            case "senhaLonga" -> p.put("senha", "x".repeat(73));
        }
        mvc.perform(post("/usuarios").header(HttpHeaders.AUTHORIZATION, authorization).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(p))).andExpect(status().isBadRequest());
        assertThat(usuarios.count()).isEqualTo(quantidadeInicial);
    }
    @Test void cadastroETelefoneEdicaoSemAtivoNaoReativaUsuario() throws Exception {
        var p = dados(); p.put("telefone", "11999999999"); p.put("ativo", false);
        var resposta = mvc.perform(post("/usuarios").header(HttpHeaders.AUTHORIZATION, authorization).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(p))).andExpect(status().isOk()).andExpect(jsonPath("$.telefone").value("11999999999"))
                .andExpect(jsonPath("$.senha").doesNotExist()).andReturn();
        long id = json.readTree(resposta.getResponse().getContentAsString()).get("id").asLong();
        p.remove("ativo"); p.remove("senha"); p.put("telefone", "11888888888");
        mvc.perform(put("/usuarios/" + id).header(HttpHeaders.AUTHORIZATION, authorization).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(p))).andExpect(status().isOk()).andExpect(jsonPath("$.ativo").value(false))
                .andExpect(jsonPath("$.telefone").value("11888888888"));
    }
    @Test void putEDeleteNaoContornamBloqueioDeAutoInativacao() throws Exception {
        var p = dados(); p.put("cpf", usuarioA.getCpf()); p.put("ativo", false);
        mvc.perform(put("/usuarios/" + usuarioA.getId()).header(HttpHeaders.AUTHORIZATION, authorization).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(p))).andExpect(status().isConflict());
        mvc.perform(delete("/usuarios/" + usuarioA.getId()).header(HttpHeaders.AUTHORIZATION, authorization)).andExpect(status().isConflict());
        assertThat(usuarios.findById(usuarioA.getId()).orElseThrow().getAtivo()).isTrue();
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
        usuario.setNomeUsuario("Usuário de teste");
        usuario.setCpf(cpf);
        usuario.setSenha(passwordEncoder.encode("senha123"));
        usuario.setPerfil(PerfilUsuario.ADMIN);
        return usuarios.saveAndFlush(usuario);
    }
}
