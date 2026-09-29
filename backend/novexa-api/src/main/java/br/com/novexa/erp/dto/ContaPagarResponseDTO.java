package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.*;
import java.math.BigDecimal;
import java.time.LocalDate;

public record ContaPagarResponseDTO(Long id, String descricao, String documento, Long fornecedorId, String fornecedorNome,
        String categoria, LocalDate dataEmissao, LocalDate dataVencimento, BigDecimal valor,
        StatusContaPagar status, LocalDate dataPagamento, BigDecimal valorPago, String observacao) {
    public static ContaPagarResponseDTO de(ContaPagarEntity conta) {
        var fornecedor = conta.getFornecedor();
        return new ContaPagarResponseDTO(conta.getId(), conta.getDescricao(), conta.getDocumento(),
                fornecedor == null ? null : fornecedor.getId(),
                fornecedor == null ? null : fornecedor.getRazaoSocial(),
                conta.getCategoria(), conta.getDataEmissao(), conta.getDataVencimento(),
                conta.getValor(), conta.getStatus(), conta.getDataPagamento(), conta.getValorPago(),
                conta.getObservacao());
    }
}
