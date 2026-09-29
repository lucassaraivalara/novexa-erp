package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.MovimentacaoFinanceiraEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import java.util.List;
import java.util.Optional;

public interface MovimentacaoFinanceiraRepository extends JpaRepository<MovimentacaoFinanceiraEntity, Long> {
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
