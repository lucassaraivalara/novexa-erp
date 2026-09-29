package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.ModalidadeConferencia;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record SessaoCaixaDetalheDTO(SessaoCaixaHistoricoDTO sessao, ResumoSessaoCaixaDTO resumo,
        ModalidadeConferencia modalidadeConferencia, String observacaoFechamento,
        List<ConferenciaFechamentoCaixaDTO> conferencias, List<Evento> movimentacoes) {
    public record Evento(String tipo, LocalDateTime dataHora, BigDecimal valor, Long vendaId, String observacao) { }
}
