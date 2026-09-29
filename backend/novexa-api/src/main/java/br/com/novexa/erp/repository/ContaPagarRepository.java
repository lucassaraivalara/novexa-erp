package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.ContaPagarEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import java.util.List;
import java.util.Optional;

public interface ContaPagarRepository extends JpaRepository<ContaPagarEntity, Long> {
    @EntityGraph(attributePaths = "fornecedor")
    List<ContaPagarEntity> findByEmpresaIdOrderByDataVencimentoAscIdAsc(Long empresaId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ContaPagarEntity c left join fetch c.fornecedor where c.id = :id and c.empresa.id = :empresaId")
    Optional<ContaPagarEntity> buscarParaAlterar(Long id, Long empresaId);
}
