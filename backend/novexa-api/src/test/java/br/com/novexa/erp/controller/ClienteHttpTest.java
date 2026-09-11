package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.entity.PerfilUsuario;
import br.com.novexa.erp.repository.ClienteRepository;
import br.com.novexa.erp.repository.EmpresaRepository;
import br.com.novexa.erp.service.JwtService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

// HTTP real, sem transação de teste: a serialização ocorre após a transação do controller.
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:cliente-http;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false",
        "spring.jpa.open-in-view=false", "spring.jpa.show-sql=false",
        "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=60000"
})
@Import(ClienteHttpTest.FalhaController.class)
class ClienteHttpTest {
    @Autowired TestRestTemplate http;
    @Autowired ObjectMapper json;
    @Autowired EmpresaRepository empresas;
    @Autowired ClienteRepository clientes;
    @Autowired JwtService jwt;
    private HttpHeaders headers;

    @BeforeEach
    void preparar() {
        var empresa = new EmpresaEntity();
        empresa.setRazaoSocial("Empresa de teste HTTP");
        empresa.setCnpj("11222333000181");
        empresa.setAtivo(true);
        empresas.saveAndFlush(empresa);
        headers = new HttpHeaders();
        headers.setBearerAuth(jwt.gerarToken(1L, "02360684663", empresa.getId(), PerfilUsuario.USUARIO));
        headers.setContentType(MediaType.APPLICATION_JSON);
    }

    @AfterEach
    void limpar() {
        clientes.deleteAll();
        empresas.deleteAll();
    }

    @Test
    void listarCriarEBuscarEditarClienteComMesmoToken() throws Exception {
        assertThat(chamar(HttpMethod.GET, "/clientes", null).getStatusCode()).isEqualTo(HttpStatus.OK);
        var criado = chamar(HttpMethod.POST, "/clientes", dados("Cliente HTTP"));
        assertThat(criado.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        long id = json.readTree(criado.getBody()).get("id").asLong();

        var lista = chamar(HttpMethod.GET, "/clientes", null);
        assertThat(lista.getStatusCode()).isEqualTo(HttpStatus.OK);
        validarColecoes(json.readTree(lista.getBody()).get(0));
        var detalhe = chamar(HttpMethod.GET, "/clientes/" + id, null);
        assertThat(detalhe.getStatusCode()).isEqualTo(HttpStatus.OK);
        validarColecoes(json.readTree(detalhe.getBody()));

        var editado = chamar(HttpMethod.PUT, "/clientes/" + id, dados("Cliente atualizado"));
        assertThat(editado.getStatusCode()).isEqualTo(HttpStatus.OK);
        validarColecoes(json.readTree(editado.getBody()));
        var relido = chamar(HttpMethod.GET, "/clientes/" + id, null);
        assertThat(relido.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(json.readTree(relido.getBody()).get("nome").asText()).isEqualTo("Cliente atualizado");
    }

    @Test
    void falhaInternaNaoVira401EOutraRotaContinuaAcessivel() {
        var falha = chamar(HttpMethod.GET, "/teste/falha", null);
        assertThat(falha.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(falha.getHeaders().getFirst(HttpHeaders.WWW_AUTHENTICATE)).isNull();
        assertThat(falha.getBody()).doesNotContain("detalhe interno", "IllegalStateException");
        assertThat(chamar(HttpMethod.GET, "/clientes", null).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(http.getForEntity("/error", String.class).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    private ResponseEntity<String> chamar(HttpMethod metodo, String url, Object dados) {
        return http.exchange(url, metodo, new HttpEntity<>(dados, headers), String.class);
    }

    private Map<String, Object> dados(String nome) {
        return Map.of("nome", nome, "tipoPessoa", "FISICA", "cpfCnpj", "52998224725",
                "enderecos", List.of(Map.of("logradouro", "Rua Teste", "cidade", "São Paulo", "uf", "SP")),
                "contatos", List.of(Map.of("nome", "Contato Teste")));
    }

    private void validarColecoes(JsonNode cliente) {
        assertThat(cliente.get("enderecos").get(0).get("cidade").asText()).isEqualTo("São Paulo");
        assertThat(cliente.get("contatos").get(0).get("nome").asText()).isEqualTo("Contato Teste");
    }

    @RestController
    static class FalhaController {
        @GetMapping("/teste/falha")
        void falhar() { throw new IllegalStateException("detalhe interno"); }
    }
}
