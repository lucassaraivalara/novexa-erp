package br.com.novexa.erp.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.*;

@Service
public class EmpresaGeocodificacaoService {
    public record Coordenada(String descricao, BigDecimal latitude, BigDecimal longitude) { }
    private final String url;
    private final RestClient client;
    private long ultimaConsulta;
    private final Map<String, List<Coordenada>> cache = new LinkedHashMap<>(32, .75f, true) {
        @Override protected boolean removeEldestEntry(Map.Entry<String, List<Coordenada>> entrada) { return size() > 256; }
    };

    public EmpresaGeocodificacaoService(@Value("${novexa.geocoding.url:}") String url,
            @Value("${novexa.geocoding.user-agent:NovexaERP/1.0}") String userAgent) {
        this.url = url;
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(10));
        client = RestClient.builder().requestFactory(factory).defaultHeader("User-Agent", userAgent).build();
    }

    public boolean configurado() { return !url.isBlank(); }

    public synchronized List<Coordenada> buscar(String endereco) {
        if (!configurado()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "O serviço de coordenadas ainda não foi configurado. Preencha manualmente.");
        String chave = endereco.strip().toLowerCase(Locale.ROOT);
        if (cache.containsKey(chave)) return cache.get(chave);
        long agora = System.nanoTime();
        if (ultimaConsulta != 0 && agora - ultimaConsulta < 1_100_000_000L) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Aguarde um instante antes de buscar novamente.");
        ultimaConsulta = agora;
        try {
            var uri = UriComponentsBuilder.fromUriString(url).queryParam("q", endereco).queryParam("format", "jsonv2")
                    .queryParam("countrycodes", "br").queryParam("limit", 5).build().encode().toUri();
            JsonNode resposta = client.get().uri(uri).retrieve().body(JsonNode.class);
            if (resposta == null || !resposta.isArray()) throw new IllegalArgumentException();
            List<Coordenada> encontrados = new ArrayList<>();
            for (JsonNode item : resposta) {
                var lat = new BigDecimal(item.path("lat").asText()).setScale(7, java.math.RoundingMode.HALF_UP);
                var lon = new BigDecimal(item.path("lon").asText()).setScale(7, java.math.RoundingMode.HALF_UP);
                if (lat.abs().compareTo(BigDecimal.valueOf(90)) > 0 || lon.abs().compareTo(BigDecimal.valueOf(180)) > 0) continue;
                encontrados.add(new Coordenada(item.path("display_name").asText(), lat, lon));
                if (encontrados.size() == 5) break;
            }
            var resultado = List.copyOf(encontrados);
            cache.put(chave, resultado);
            return resultado;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Não foi possível consultar o serviço de coordenadas. Tente novamente ou preencha manualmente.");
        }
    }
}
