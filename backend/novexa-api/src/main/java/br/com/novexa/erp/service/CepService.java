package br.com.novexa.erp.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import java.time.Duration;

@Service
public class CepService {
    public record Endereco(String cep, String logradouro, String bairro, String cidade, String uf) { }
    private final RestClient client;

    public CepService() {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(2));
        factory.setReadTimeout(Duration.ofSeconds(3));
        client = RestClient.builder().baseUrl("https://viacep.com.br/ws").requestFactory(factory).build();
    }

    CepService(RestClient client) { this.client = client; }

    public Endereco buscar(String cep) {
        String normalizado = cep == null ? "" : cep.strip().replace("-", "");
        if (!normalizado.matches("[0-9]{8}"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe um CEP com 8 dígitos. Você também pode preencher o endereço manualmente.");
        JsonNode resposta;
        try {
            resposta = client.get().uri("/{cep}/json/", normalizado).retrieve().body(JsonNode.class);
        } catch (Exception e) {
            throw indisponivel();
        }
        if (resposta == null || !resposta.isObject()) throw indisponivel();
        if (resposta.path("erro").asBoolean(false))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "CEP não encontrado. Confira o CEP ou preencha o endereço manualmente.");
        String cidade = resposta.path("localidade").asText("");
        String uf = resposta.path("uf").asText("");
        if (cidade.isBlank() || cidade.length() > 100 || !uf.matches("[A-Z]{2}")
                || resposta.path("logradouro").asText("").length() > 150
                || resposta.path("bairro").asText("").length() > 100) throw indisponivel();
        return new Endereco(normalizado, resposta.path("logradouro").asText(""),
                resposta.path("bairro").asText(""), cidade, uf);
    }

    private ResponseStatusException indisponivel() {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Consulta de CEP indisponível. Preencha o endereço manualmente; o cadastro continua disponível.");
    }
}
