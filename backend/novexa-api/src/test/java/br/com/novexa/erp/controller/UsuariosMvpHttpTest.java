package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.service.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:usuarios-mvp;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.username=sa", "spring.datasource.password=", "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false", "spring.jpa.show-sql=false",
    "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=60000"
})
@AutoConfigureMockMvc
@Transactional
class UsuariosMvpHttpTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UsuarioRepository usuarios;
    @Autowired EmpresaRepository empresas;
    @Autowired PasswordEncoder encoder;
    @Autowired JwtService jwt;
    @Autowired EntityManager em;
    EmpresaEntity empresa, outra;
    UsuarioEntity admin, alvo, externo;
    String auth;

    @BeforeEach void preparar() {
        empresa = empresa("Empresa A", "11222333000181"); outra = empresa("Empresa B", "12345678000190");
        admin = usuario(empresa, "52998224725", "admin", PerfilUsuario.ADMIN);
        alvo = usuario(empresa, "11144477735", "operador", PerfilUsuario.OPERADOR);
        externo = usuario(outra, "12345678909", "externo", PerfilUsuario.ADMIN);
        auth = "Bearer " + jwt.gerarToken(admin);
    }

    @Test void cadastraComHashSemSegredosEPermiteLogin() throws Exception {
        var resultado = mvc.perform(post("/usuarios").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(dados()))).andExpect(status().isOk())
            .andExpect(jsonPath("$.senha").doesNotExist()).andExpect(jsonPath("$.versaoToken").doesNotExist())
            .andExpect(jsonPath("$.login").value("novo")).andExpect(jsonPath("$.empresa.id").value(empresa.getId())).andReturn();
        var salvo = usuarios.findById(json.readTree(resultado.getResponse().getContentAsString()).get("id").asLong()).orElseThrow();
        assertThat(salvo.getSenha()).startsWith("$2"); assertThat(encoder.matches(" senha nova ", salvo.getSenha())).isTrue();
        login(salvo.getCpf(), " senha nova ", 200);
    }

    @ParameterizedTest @ValueSource(strings = {"cpf", "login", "email"})
    void duplicidadeIdentificaCampoSemAlterarProdutosOuUsuarios(String campo) throws Exception {
        var p = dados(); p.put(campo, switch(campo) { case "cpf" -> alvo.getCpf(); case "login" -> " OPERADOR "; default -> alvo.getEmail().toUpperCase(); });
        long antes = usuarios.count();
        mvc.perform(post("/usuarios").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(p))).andExpect(status().isConflict());
        assertThat(usuarios.count()).isEqualTo(antes);
    }

    @Test void loginEmailPodemRepetirEmOutraEmpresaEJwtDefineTenant() throws Exception {
        var p = dados(); p.put("login", externo.getLogin()); p.put("email", externo.getEmail()); p.put("empresaId", outra.getId());
        mvc.perform(post("/usuarios").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(p)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.empresa.id").value(empresa.getId()));
    }

    @Test void editaSemTrocarSenhaNemEmpresaEPerfilGestorReutilizaGerente() throws Exception {
        var p = dados(); p.put("cpf", alvo.getCpf()); p.put("perfil", "GESTOR"); p.remove("senha");
        String hash = alvo.getSenha();
        mvc.perform(put("/usuarios/"+alvo.getId()).header("Authorization", auth).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(p)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.perfil").value("GERENTE")).andExpect(jsonPath("$.senha").doesNotExist());
        assertThat(alvo.getSenha()).isEqualTo(hash); assertThat(alvo.getEmpresa().getId()).isEqualTo(empresa.getId());
    }

    @Test void redefineSenhaRevogaTokenAnteriorEPermiteNovoLogin() throws Exception {
        String anterior = "Bearer " + jwt.gerarToken(alvo);
        mvc.perform(patch("/usuarios/"+alvo.getId()+"/senha").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
            .content("{\"senha\":\"nova senha\"}")).andExpect(status().isOk()).andExpect(jsonPath("$.senha").doesNotExist());
        em.flush(); em.clear();
        mvc.perform(get("/clientes").header("Authorization", anterior)).andExpect(status().isUnauthorized());
        login(alvo.getCpf(), "senha123", 401);
        var resultado = login(alvo.getCpf(), "nova senha", 200);
        String token = json.readTree(resultado.getResponse().getContentAsString()).get("token").asText();
        mvc.perform(get("/clientes").header("Authorization", "Bearer "+token)).andExpect(status().isOk());
    }

    @Test void inativaEReativaSemRessuscitarTokensAnteriores() throws Exception {
        String anterior = "Bearer " + jwt.gerarToken(alvo);
        situacao(alvo, false, 200); login(alvo.getCpf(), "senha123", 401);
        situacao(alvo, true, 200); login(alvo.getCpf(), "senha123", 200);
        mvc.perform(get("/clientes").header("Authorization", anterior)).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest @ValueSource(strings = {"patch", "delete", "put"})
    void naoInativaOuRemovePropriaConta(String via) throws Exception {
        if (via.equals("patch")) situacao(admin, false, 409);
        else if (via.equals("delete")) mvc.perform(delete("/usuarios/"+admin.getId()).header("Authorization", auth)).andExpect(status().isConflict());
        else { var p=dados(); p.put("cpf",admin.getCpf()); p.put("ativo",false);
            mvc.perform(put("/usuarios/"+admin.getId()).header("Authorization",auth).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(p))).andExpect(status().isConflict()); }
        assertThat(admin.getAtivo()).isTrue();
    }

    @Test void naoRebaixaUltimoAdminNemPreservado() throws Exception {
        var p=dados(); p.put("cpf",admin.getCpf()); p.put("perfil","OPERADOR");
        mvc.perform(put("/usuarios/"+admin.getId()).header("Authorization",auth).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(p))).andExpect(status().isConflict());
        var preservado=usuario(empresa,"02360684663","preservado",PerfilUsuario.ADMIN);
        situacao(preservado,false,409);
        mvc.perform(delete("/usuarios/"+preservado.getId()).header("Authorization",auth)).andExpect(status().isConflict());
        p=dados(); p.put("cpf",preservado.getCpf()); p.put("perfil","OPERADOR");
        mvc.perform(put("/usuarios/"+preservado.getId()).header("Authorization",auth).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(p))).andExpect(status().isConflict());
        assertThat(preservado.getAtivo()).isTrue(); assertThat(preservado.getPerfil()).isEqualTo(PerfilUsuario.ADMIN);
    }

    @ParameterizedTest @ValueSource(strings={"GET","PUT","DELETE","senha","situacao"})
    void outroTenantNaoPodeSerConsultadoOuAlterado(String metodo) throws Exception {
        String path="/usuarios/"+externo.getId();
        var req=switch(metodo) {case "GET"->get(path);case "PUT"->put(path);case "DELETE"->delete(path);default->patch(path+"/"+metodo);};
        mvc.perform(req.header("Authorization",auth).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(metodo.equals("PUT")?dados():Map.of("ativo",false,"senha","nova")))).andExpect(status().isNotFound());
    }

    @ParameterizedTest @ValueSource(strings={"GERENTE","GESTOR","OPERADOR","USUARIO"})
    void somenteAdminGerenciaUsuarios(String perfil) throws Exception {
        alvo.setPerfil(PerfilUsuario.de(perfil)); usuarios.saveAndFlush(alvo);
        String token="Bearer "+jwt.gerarToken(alvo);
        for (String path:List.of("/usuarios","/usuarios/pagina","/usuarios/"+admin.getId()))
            mvc.perform(get(path).header("Authorization",token)).andExpect(status().isForbidden());
        mvc.perform(post("/usuarios").header("Authorization",token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dados()))).andExpect(status().isForbidden());
        mvc.perform(patch("/usuarios/"+admin.getId()+"/senha").header("Authorization",token).contentType(MediaType.APPLICATION_JSON).content("{\"senha\":\"nova\"}")).andExpect(status().isForbidden());
    }

    @ParameterizedTest @ValueSource(strings={"ausente","","   ","Operador","111.444.777-35","operador@teste.com"})
    void buscaPaginadaPorNomeCpfLoginEmailESituacao(String busca) throws Exception {
        var req=get("/usuarios/pagina").header("Authorization",auth).param("size","1").param("sort","nomeUsuario,desc");
        if(!busca.equals("ausente")) req.param("termo",busca);
        mvc.perform(req).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].id").value(alvo.getId())).andExpect(jsonPath("$.items[0].senha").doesNotExist());
        mvc.perform(get("/usuarios/pagina").header("Authorization",auth).param("ativo","false"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(0));
        mvc.perform(get("/usuarios/pagina").header("Authorization",auth).param("size","1").param("page","1").param("sort","nomeUsuario,asc"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(2)).andExpect(jsonPath("$.items[0].id").value(alvo.getId()));
    }

    @Test void filtroAtivoELiteraisNaoConfundemConsultaVazia() throws Exception {
        situacao(alvo,false,200);
        mvc.perform(get("/usuarios/pagina").header("Authorization",auth).param("ativo","false"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1));
        mvc.perform(get("/usuarios/pagina").header("Authorization",auth).param("termo","%"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(0));
        mvc.perform(get("/usuarios/pagina").header("Authorization",auth).param("sort","senha,asc")).andExpect(status().isBadRequest());
    }

    Map<String,Object> dados(){ return new HashMap<>(Map.of("nomeUsuario","Novo usuário","cpf","39053344705","login","novo","email","novo@teste.com","senha"," senha nova ","perfil","OPERADOR","ativo",true)); }
    void situacao(UsuarioEntity u,boolean ativo,int status)throws Exception{mvc.perform(patch("/usuarios/"+u.getId()+"/situacao").header("Authorization",auth).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("ativo",ativo)))).andExpect(status().is(status));}
    org.springframework.test.web.servlet.MvcResult login(String cpf,String senha,int status)throws Exception{return mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("cpf",cpf,"senha",senha)))).andExpect(status().is(status)).andExpect(jsonPath("$.senha").doesNotExist()).andReturn();}
    EmpresaEntity empresa(String nome,String cnpj){var e=new EmpresaEntity();e.setRazaoSocial(nome);e.setCnpj(cnpj);e.setAtivo(true);return empresas.saveAndFlush(e);}
    UsuarioEntity usuario(EmpresaEntity e,String cpf,String login,PerfilUsuario perfil){var u=new UsuarioEntity();u.setEmpresa(e);u.setCpf(cpf);u.setLogin(login);u.setNomeUsuario(login.equals("operador")?"Operador":"Administrador");u.setEmail(login+"@teste.com");u.setSenha(encoder.encode("senha123"));u.setPerfil(perfil);return usuarios.saveAndFlush(u);}
}
