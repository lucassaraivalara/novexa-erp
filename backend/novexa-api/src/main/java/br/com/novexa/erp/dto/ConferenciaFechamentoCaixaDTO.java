package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.*;
import java.math.BigDecimal;

public record ConferenciaFechamentoCaixaDTO(EscopoConferenciaCaixa escopo, Long formaPagamentoId,
        String descricao, TipoFormaPagamento tipo, BigDecimal valorEsperado,
        BigDecimal valorInformado, BigDecimal diferenca, Long configuracaoId, Long usuarioId, java.time.LocalDateTime dataHora) {
    public static ConferenciaFechamentoCaixaDTO de(ConferenciaFechamentoCaixaEntity linha) {
        return new ConferenciaFechamentoCaixaDTO(linha.getEscopo(),
                linha.getForma() == null ? null : linha.getForma().getId(),
                linha.getDescricaoSnapshot(), linha.getTipoSnapshot(), linha.getValorEsperado(),
                linha.getValorInformado(), linha.getDiferenca(), linha.getConfiguracaoId(),
                linha.getSessao().getUsuarioFechamento().getId(),linha.getSessao().getDataFechamento());
    }
}
