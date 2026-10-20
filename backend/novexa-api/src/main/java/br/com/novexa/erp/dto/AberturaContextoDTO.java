package br.com.novexa.erp.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record AberturaContextoDTO(
        Long caixaId,
        String descricaoCaixa,
        boolean caixaAtivo,
        boolean sessaoAberta,
        Long sessaoAbertaId,
        TrocoAnteriorDTO trocoAnterior,
        List<CofreOpcaoDTO> cofres,
        BigDecimal saldoSugerido,
        boolean podeMovimentarCofre
) {
    public record TrocoAnteriorDTO(
            Long sessaoId,
            BigDecimal valor,
            LocalDateTime dataFechamento,
            String operadorFechamento
    ) {}

    public record CofreOpcaoDTO(
            Long id,
            String nome,
            BigDecimal saldoAtual
    ) {}
}
