package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.ImportacaoProdutoEntity;
import org.springframework.data.jpa.repository.*;
import jakarta.persistence.LockModeType;
import java.util.*;

public interface ImportacaoProdutoRepository extends JpaRepository<ImportacaoProdutoEntity, UUID> {
    Optional<ImportacaoProdutoEntity> findByEmpresaIdAndHashArquivo(Long empresaId, String hashArquivo);
    Optional<ImportacaoProdutoEntity> findByIdAndEmpresaId(UUID id, Long empresaId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from ImportacaoProdutoEntity i where i.id=:id and i.empresaId=:empresaId")
    Optional<ImportacaoProdutoEntity> buscarComLock(UUID id, Long empresaId);
}
