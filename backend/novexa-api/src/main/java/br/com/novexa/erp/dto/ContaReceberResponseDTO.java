package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record ContaReceberResponseDTO(Long id, ClienteResumo cliente, Long vendaId, String descricao,
        BigDecimal valorOriginal, BigDecimal valorRecebido, BigDecimal saldo, LocalDate dataEmissao,
        LocalDate dataVencimento, StatusContaReceber status, OrigemContaReceber origem,
        int numeroParcela, int totalParcelas, String observacao, LocalDateTime dataCriacao,
        LocalDateTime dataAtualizacao, List<MovimentacaoFinanceiraResponseDTO> recebimentos) {
    public record ClienteResumo(Long id, String nome, String cpfCnpj, boolean ativo) { }
    public static ContaReceberResponseDTO de(ContaReceberEntity c, List<MovimentacaoFinanceiraResponseDTO> recebimentos) {
        var cliente = c.getCliente();
        return new ContaReceberResponseDTO(c.getId(), new ClienteResumo(cliente.getId(), cliente.getNome(),
                cliente.getCpfCnpj(), Boolean.TRUE.equals(cliente.getAtivo())),
                c.getVenda() == null ? null : c.getVenda().getId(), c.getDescricao(), c.getValorOriginal(),
                c.getValorRecebido(), c.getSaldo(), c.getDataEmissao(), c.getDataVencimento(), c.getStatus(),
                c.getOrigem(), c.getNumeroParcela(), c.getTotalParcelas(), c.getObservacao(),
                c.getDataCriacao(), c.getDataAtualizacao(), recebimentos);
    }
}
