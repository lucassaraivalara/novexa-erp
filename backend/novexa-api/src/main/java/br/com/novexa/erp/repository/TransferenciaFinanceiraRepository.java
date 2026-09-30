package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.TransferenciaFinanceiraEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TransferenciaFinanceiraRepository extends JpaRepository<TransferenciaFinanceiraEntity, Long> {
    Optional<TransferenciaFinanceiraEntity> findByEmpresaIdAndChaveRequisicao(Long empresaId, UUID chave);
    @EntityGraph(attributePaths = {"contaOrigem", "contaDestino", "usuario", "usuarioEstorno"})
    List<TransferenciaFinanceiraEntity> findByEmpresaIdOrderByDataMovimentoDescIdDesc(Long empresaId);

    interface ContasTransferencia {
        Long getOrigemId();
        Long getDestinoId();
    }
    @Query("select t.contaOrigem.id as origemId, t.contaDestino.id as destinoId from TransferenciaFinanceiraEntity t where t.id = :id and t.empresa.id = :empresaId")
    Optional<ContasTransferencia> buscarContas(Long id, Long empresaId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from TransferenciaFinanceiraEntity t where t.id = :id and t.empresa.id = :empresaId")
    Optional<TransferenciaFinanceiraEntity> buscarParaEstornar(Long id, Long empresaId);
}
