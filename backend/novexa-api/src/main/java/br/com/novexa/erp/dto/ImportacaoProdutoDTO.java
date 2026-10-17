package br.com.novexa.erp.dto;

import java.util.*;

public record ImportacaoProdutoDTO(UUID id, String arquivo, String estado, int validas, int invalidas,
        int duplicadas, int ignoradas, int importados, List<String> colunasIgnoradas, List<Linha> linhas) {
    public record Linha(int linha, String situacao, String mensagem, Map<String,String> campos, ProdutoRequestDTO produto) {}
}
