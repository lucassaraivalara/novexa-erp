package br.com.novexa.erp.storage;

import org.springframework.web.multipart.MultipartFile;

public interface ArquivoStorageService {

    String salvarImagemProduto(Long empresaId, Long produtoId, MultipartFile arquivo);

    void removerImagem(String caminho);

    String obterUrlPublica(String caminho);
}