package br.com.novexa.erp.service;

import br.com.novexa.erp.time.TempoNovexa;

import br.com.novexa.erp.entity.ModoRecebimentoFinanceiro;
import br.com.novexa.erp.entity.StatusRecebivel;
import br.com.novexa.erp.repository.RecebivelRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;


@Component
public class LiquidacaoAutomaticaCartaoScheduler {
    private static final Logger log = LoggerFactory.getLogger(LiquidacaoAutomaticaCartaoScheduler.class);
    private final RecebivelRepository recebiveis;
    private final LiquidacaoRecebivelService liquidacao;

    public LiquidacaoAutomaticaCartaoScheduler(RecebivelRepository recebiveis, LiquidacaoRecebivelService liquidacao) {
        this.recebiveis = recebiveis;
        this.liquidacao = liquidacao;
    }

    @Scheduled(initialDelay = 60_000, fixedDelay = 3_600_000)
    public void processarVencidos() {
        long limiteId = recebiveis.findMaxId();
        long aposId = 0;
        var hoje = TempoNovexa.hoje();
        while (aposId < limiteId) {
            var lote = recebiveis.buscarVencidosAutomaticos(aposId, limiteId, StatusRecebivel.PENDENTE,
                    ModoRecebimentoFinanceiro.SIMPLIFICADO, hoje, PageRequest.of(0, 100));
            if (lote.isEmpty()) break;
            for (var candidato : lote) {
                try {
                    liquidacao.liquidarAutomaticamente(candidato.getId(), candidato.getEmpresaId());
                } catch (RuntimeException erro) {
                    log.error("Liquidação automática do recebível {} falhou: {}", candidato.getId(), erro.getClass().getSimpleName());
                }
            }
            aposId = lote.getLast().getId();
        }
    }
}
