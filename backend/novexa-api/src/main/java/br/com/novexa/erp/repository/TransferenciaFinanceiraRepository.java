package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.TransferenciaFinanceiraEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TransferenciaFinanceiraRepository extends JpaRepository<TransferenciaFinanceiraEntity, Long> {
    @org.springframework.data.jpa.repository.Query("""
        select t from TransferenciaFinanceiraEntity t where t.empresa.id = :empresaId
         and (:contaOrigemId is null or t.contaOrigem.id = :contaOrigemId)
         and (:contaDestinoId is null or t.contaDestino.id = :contaDestinoId)
         and (:status is null or t.status = :status)
         and (cast(:dataInicial as date) is null or t.dataMovimento >= :dataInicial)
         and (cast(:dataFinal as date) is null or t.dataMovimento <= :dataFinal)
        """)
    org.springframework.data.domain.Page<TransferenciaFinanceiraEntity> listarPagina(Long empresaId, Long contaOrigemId, Long contaDestinoId, br.com.novexa.erp.entity.StatusTransferenciaFinanceira status, java.time.LocalDate dataInicial, java.time.LocalDate dataFinal,
            org.springframework.data.domain.Pageable pageable);

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
