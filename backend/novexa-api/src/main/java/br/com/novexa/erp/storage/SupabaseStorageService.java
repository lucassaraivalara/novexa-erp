package br.com.novexa.erp.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

@Service
public class SupabaseStorageService implements ArquivoStorageService {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.secret-key}")
    private String supabaseSecretKey;

    @Value("${supabase.bucket}")
    private String supabaseBucket;

    private final RestTemplate restTemplate = new RestTemplate();

    @Override
    public String salvarImagemProduto(
            Long empresaId,
            Long produtoId,
            MultipartFile arquivo
    ) {
        try {
            String extensao = obterExtensao(arquivo.getOriginalFilename());

            String nomeArquivo = UUID.randomUUID() + extensao;

            String caminho =
                    "empresa-" + empresaId +
                            "/produto-" + produtoId +
                            "/" + nomeArquivo;

            String urlUpload =
                    supabaseUrl +
                            "/storage/v1/object/" +
                            supabaseBucket +
                            "/" +
                            caminho;

            HttpHeaders headers = new HttpHeaders();

            headers.setBearerAuth(supabaseSecretKey);
            headers.set("apikey", supabaseSecretKey);

            if (arquivo.getContentType() != null) {
                headers.setContentType(
                        MediaType.parseMediaType(
                                arquivo.getContentType()
                        )
                );
            }

            HttpEntity<byte[]> requisicao =
                    new HttpEntity<>(
                            arquivo.getBytes(),
                            headers
                    );

            ResponseEntity<String> resposta =
                    restTemplate.exchange(
                            urlUpload,
                            HttpMethod.POST,
                            requisicao,
                            String.class
                    );

            if (!resposta.getStatusCode().is2xxSuccessful()) {
                throw new RuntimeException(
                        "Erro ao enviar imagem para o Supabase."
                );
            }

            return caminho;

        } catch (IOException e) {
            throw new RuntimeException(
                    "Erro ao ler arquivo da imagem.",
                    e
            );
        }
    }

    @Override
    public void removerImagem(String caminho) {

        if (caminho == null || caminho.isBlank()) {
            return;
        }

        String url =
                supabaseUrl +
                        "/storage/v1/object/" +
                        supabaseBucket +
                        "/" +
                        caminho;

        HttpHeaders headers = new HttpHeaders();

        headers.setBearerAuth(supabaseSecretKey);
        headers.set("apikey", supabaseSecretKey);

        HttpEntity<Void> requisicao =
                new HttpEntity<>(headers);

        restTemplate.exchange(
                url,
                HttpMethod.DELETE,
                requisicao,
                Void.class
        );
    }

        @Override
        public String obterUrlPublica(String caminho) {
                if (caminho == null || caminho.isBlank()) {
                        return null;
                }

                return supabaseUrl + "/storage/v1/object/public/" + supabaseBucket + "/" + caminho;
        }

    private String obterExtensao(String nomeArquivo) {

        if (nomeArquivo == null) {
            return "";
        }

        int ultimoPonto = nomeArquivo.lastIndexOf(".");

        if (ultimoPonto == -1) {
            return "";
        }

        return nomeArquivo.substring(ultimoPonto);
    }
}