package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.MovimentacaoCaixaEntity;
import br.com.novexa.erp.entity.TipoMovimentacaoCaixa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;
import java.util.*;

public interface MovimentacaoCaixaRepository extends JpaRepository<MovimentacaoCaixaEntity, Long> {
    interface SaldoMovimentacoesSessao {
        Long getSessaoId();
        BigDecimal getEntradas();
        BigDecimal getSaidas();
    }

    Optional<MovimentacaoCaixaEntity> findByPagamentoIdAndTipoAndSessaoIdAndEmpresaId(Long pagamentoId, br.com.novexa.erp.entity.TipoMovimentacaoCaixa tipo, Long sessaoId, Long empresaId);
    Optional<MovimentacaoCaixaEntity> findBySessaoIdAndEmpresaIdAndChaveRequisicao(Long sessaoId, Long empresaId, UUID chave);
    List<MovimentacaoCaixaEntity> findBySessaoIdAndEmpresaIdOrderByIdAsc(Long sessaoId, Long empresaId);

    @Query("""
            select m.sessao.id as sessaoId,
                   coalesce(sum(case when m.tipo in :entradas then m.valor else 0 end), 0) as entradas,
                   coalesce(sum(case when m.tipo in :saidas then m.valor else 0 end), 0) as saidas
            from MovimentacaoCaixaEntity m
            where m.empresa.id = :empresaId
              and m.sessao.id in :sessaoIds
            group by m.sessao.id
            """)
    List<SaldoMovimentacoesSessao> resumirSaldos(@Param("empresaId") Long empresaId,
                                                  @Param("sessaoIds") Collection<Long> sessaoIds,
                                                  @Param("entradas") Collection<TipoMovimentacaoCaixa> entradas,
                                                  @Param("saidas") Collection<TipoMovimentacaoCaixa> saidas);
}
