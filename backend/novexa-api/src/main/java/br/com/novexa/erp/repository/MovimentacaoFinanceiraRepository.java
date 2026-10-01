package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.MovimentacaoFinanceiraEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import java.util.List;
import java.util.Optional;

public interface MovimentacaoFinanceiraRepository extends JpaRepository<MovimentacaoFinanceiraEntity, Long> {
    @org.springframework.data.jpa.repository.Query("""
        select m from MovimentacaoFinanceiraEntity m where m.empresa.id = :empresaId
         and (:contaFinanceiraId is null or m.contaFinanceira.id = :contaFinanceiraId)
         and (:tipo is null or m.tipo = :tipo) and (:origem is null or m.origem = :origem)
         and (cast(:dataInicial as date) is null or m.dataMovimento >= :dataInicial)
         and (cast(:dataFinal as date) is null or m.dataMovimento <= :dataFinal)
         and (:estornada is null or m.estornada = :estornada)
        """)
    org.springframework.data.domain.Page<MovimentacaoFinanceiraEntity> listarPagina(Long empresaId, Long contaFinanceiraId, br.com.novexa.erp.entity.TipoMovimentacaoFinanceira tipo, br.com.novexa.erp.entity.OrigemMovimentacaoFinanceira origem, java.time.LocalDate dataInicial, java.time.LocalDate dataFinal, Boolean estornada,
            org.springframework.data.domain.Pageable pageable);

    Optional<MovimentacaoFinanceiraEntity> findByPagamentoIdAndEmpresaId(Long pagamentoId, Long empresaId);
    Optional<MovimentacaoFinanceiraEntity> findByRecebivelIdAndEmpresaId(Long recebivelId, Long empresaId);
    interface LiquidacaoRecebivel { Long getRecebivelId(); Long getMovimentoId(); }
    @Query("select m.recebivel.id as recebivelId, m.id as movimentoId from MovimentacaoFinanceiraEntity m where m.empresa.id = :empresaId and m.recebivel.id in :ids")
    List<LiquidacaoRecebivel> buscarLiquidacoes(Long empresaId, List<Long> ids);
    List<MovimentacaoFinanceiraEntity> findByEmpresaIdAndTransferenciaIdOrderByIdAsc(Long empresaId, Long transferenciaId);
    @EntityGraph(attributePaths = {"contaFinanceira", "usuario", "usuarioEstorno"})
    List<MovimentacaoFinanceiraEntity> findByEmpresaIdOrderByDataMovimentoDescIdDesc(Long empresaId);

    @EntityGraph(attributePaths = {"contaFinanceira", "usuario", "usuarioEstorno"})
    List<MovimentacaoFinanceiraEntity> findByEmpresaIdAndContaFinanceiraIdOrderByDataMovimentoDescIdDesc(
            Long empresaId, Long contaFinanceiraId);

    @Query("select m.contaFinanceira.id from MovimentacaoFinanceiraEntity m where m.id = :id and m.empresa.id = :empresaId")
    Optional<Long> buscarContaId(Long id, Long empresaId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from MovimentacaoFinanceiraEntity m where m.id = :id and m.empresa.id = :empresaId")
    Optional<MovimentacaoFinanceiraEntity> buscarParaEstornar(Long id, Long empresaId);
}
