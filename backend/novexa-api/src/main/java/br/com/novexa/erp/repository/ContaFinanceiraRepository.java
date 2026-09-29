package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.ContaFinanceiraEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import java.util.List;
import java.util.Optional;

public interface ContaFinanceiraRepository extends JpaRepository<ContaFinanceiraEntity, Long> {
    List<ContaFinanceiraEntity> findByEmpresaIdOrderByNomeAscIdAsc(Long empresaId);
    boolean existsByIdAndEmpresaId(Long id, Long empresaId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ContaFinanceiraEntity c where c.id = :id and c.empresa.id = :empresaId")
    Optional<ContaFinanceiraEntity> buscarParaAlterar(Long id, Long empresaId);
}
