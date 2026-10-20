package br.com.novexa.erp.repository;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.PagamentoEntity;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import java.util.List;

/** Projeções em lote: destino e condições vêm exclusivamente do histórico da venda. */
public interface RecebimentoContaRepository extends Repository<PagamentoEntity, Long> {
    String BASE = """
        from PagamentoEntity p
        left join RecebivelEntity r on r.pagamento.id = p.id and r.empresa.id = :empresaId
        left join MovimentacaoFinanceiraEntity m on m.empresa.id = :empresaId
            and (m.pagamento.id = p.id or m.recebivel.id = r.id) and m.estornada = false
        where p.empresa.id = :empresaId and p.status = br.com.novexa.erp.entity.StatusPagamento.REGISTRADO
          and (p.formaPagamento = br.com.novexa.erp.entity.FormaPagamento.PIX
            or (r.id is not null and r.status <> br.com.novexa.erp.entity.StatusRecebivel.CANCELADO))
        """;
    String FILTROS = """
          and (:contaId is null or p.configuracaoContaFinanceiraDestinoId = :contaId)
          and (:semDestino = false or p.configuracaoContaFinanceiraDestinoId is null)
          and (cast(:status as string) is null
            or (cast(:status as string) = 'A_LIQUIDAR' and m.id is null)
            or (cast(:status as string) = 'LIQUIDADO' and m.id is not null))
        """;

    @Query(value = """
        select new br.com.novexa.erp.dto.RecebimentoContaDTO(
            p.id, p.venda.id, r.id, p.formaPagamento, p.configuracaoNomeExibicao,
            p.configuracaoContaFinanceiraDestinoId, p.configuracaoContaFinanceiraDestinoNome,
            p.valor, r.valorTaxasPrevisto,
            case when r.id is null then p.valor else r.valorLiquidoPrevisto end,
            p.dataHora, r.dataPrevistaRecebimento,
            case when m.id is null then 'A_LIQUIDAR' else 'LIQUIDADO' end,
            m.valor, m.dataCriacao, m.id)
        """ + BASE + FILTROS,
        countQuery = "select count(p.id) " + BASE + FILTROS)
    Page<RecebimentoContaDTO> listar(Long empresaId, Long contaId, boolean semDestino, String status, Pageable pageable);

    @Query("""
        select new br.com.novexa.erp.dto.RecebimentoContaResumoDTO(
            p.configuracaoContaFinanceiraDestinoId,
            coalesce(sum(case when m.id is null then
                (case when r.id is null then p.valor else r.valorLiquidoPrevisto end) else 0 end), 0),
            sum(case when m.id is not null then m.valor else 0 end),
            sum(case when m.id is null then 1L else 0L end),
            sum(case when m.id is null and r.id is not null and r.valorLiquidoPrevisto is null then 1L else 0L end))
        """ + BASE + " group by p.configuracaoContaFinanceiraDestinoId")
    List<RecebimentoContaResumoDTO> resumir(Long empresaId);
}
