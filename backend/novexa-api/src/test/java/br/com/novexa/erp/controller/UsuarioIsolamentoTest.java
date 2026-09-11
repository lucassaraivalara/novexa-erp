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

    @BeforeEach
    void preparar() {
        empresaA = empresa("Empresa A", "11222333000181");
        empresaB = empresa("Empresa B", "12345678000190");
        usuarioA = usuario(empresaA, "02360684663");
        usuarioB = usuario(empresaB, "52998224725");
        authorization = "Bearer " + jwtService.gerarToken(usuarioA);
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
        assertThat(usuarios.findById(alvo.getId())).isEmpty();
        assertThat(usuarios.findById(usuarioB.getId())).isPresent();
    }

    @ParameterizedTest
    @CsvSource({"GET,/usuarios", "GET,/usuarios/1", "POST,/usuarios", "PUT,/usuarios/1", "DELETE,/usuarios/1"})
    void todosOsEndpointsExigemAutenticacao(String metodo, String url) throws Exception {
        mvc.perform(request(HttpMethod.valueOf(metodo), url)).andExpect(status().isUnauthorized());
        assertThat(usuarios.count()).isEqualTo(2);
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
                    .hasMessage("Já existe outro usuário com este CPF.");
        } else {
            assertThatThrownBy(() -> usuarioService.salvar(dados, empresaA.getId()))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessage("Já existe um usuário com este CPF.");
        }
        assertThat(usuarios.count()).isEqualTo(2);
        assertThat(usuarios.findById(usuarioA.getId()).orElseThrow().getCpf()).isEqualTo("02360684663");
    }

    private Map<String, Object> dados() {
        return new HashMap<>(Map.of("nomeUsuario", "Usuário alterado", "cpf", "11144477735",
                "email", "novo@novexa.com", "senha", "novaSenha123", "perfil", "USUARIO"));
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
        usuario.setPerfil(PerfilUsuario.USUARIO);
        return usuarios.saveAndFlush(usuario);
    }
}
