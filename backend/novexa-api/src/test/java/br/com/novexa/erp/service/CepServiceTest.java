package br.com.novexa.erp.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class CepServiceTest {
    MockRestServiceServer servidor;
    CepService service;
    @BeforeEach void preparar() {
        var builder = RestClient.builder().baseUrl("https://viacep.com.br/ws");
        servidor = MockRestServiceServer.bindTo(builder).build();
        service = new CepService(builder.build());
    }
    @Test void normalizaCepEMapeiaEnderecoSemInventarNumero() {
        servidor.expect(requestTo("https://viacep.com.br/ws/01001000/json/"))
                .andRespond(withSuccess("{\"logradouro\":\"Praça da Sé\",\"bairro\":\"Sé\",\"localidade\":\"São Paulo\",\"uf\":\"SP\"}", MediaType.APPLICATION_JSON));
        assertThat(service.buscar("01001-000")).isEqualTo(new CepService.Endereco("01001000", "Praça da Sé", "Sé", "São Paulo", "SP"));
        servidor.verify();
    }
    @Test void cepInvalidoNaoConsultaProvedor() {
        for (String cep : new String[]{"", "123", "1234567x", "123456789"})
            assertThatThrownBy(() -> service.buscar(cep)).isInstanceOf(ResponseStatusException.class)
                    .hasMessageContaining("400").hasMessageContaining("manualmente");
        servidor.verify();
    }
    @Test void cepInexistentePermitePreenchimentoManual() {
        servidor.expect(requestTo("https://viacep.com.br/ws/99999999/json/"))
                .andRespond(withSuccess("{\"erro\":true}", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> service.buscar("99999999")).isInstanceOf(ResponseStatusException.class).hasMessageContaining("404");
    }
    @Test void timeoutNaoImpedeCadastroManual() {
        servidor.expect(requestTo("https://viacep.com.br/ws/01001000/json/"))
                .andRespond(withException(new java.net.SocketTimeoutException("synthetic timeout")));
        assertThatThrownBy(() -> service.buscar("01001000")).isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("503").hasMessageContaining("manualmente");
    }
    @Test void respostaInesperadaNaoPreencheEndereco() {
        servidor.expect(requestTo("https://viacep.com.br/ws/01001000/json/"))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> service.buscar("01001000")).isInstanceOf(ResponseStatusException.class).hasMessageContaining("503");
    }
}
