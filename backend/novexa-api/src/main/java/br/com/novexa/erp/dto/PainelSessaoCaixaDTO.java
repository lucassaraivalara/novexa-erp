package br.com.novexa.erp.dto;

import java.util.List;

public record PainelSessaoCaixaDTO(ResumoSessaoCaixaDTO resumo,
        List<MovimentacaoCaixaResponseDTO> movimentacoes, List<VendaSessaoCaixaDTO> vendas) { }
