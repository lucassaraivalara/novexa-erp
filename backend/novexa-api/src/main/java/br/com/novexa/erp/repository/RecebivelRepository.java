package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;

public interface RecebivelRepository extends JpaRepository<RecebivelEntity, Long> {
    @Query("""
        select r from RecebivelEntity r where r.empresa.id = :empresaId
          and (:status is null or r.status = :status)
          and (:tipo is null or r.tipo = :tipo)
          and (:vendaId is null or r.venda.id = :vendaId)
          and (cast(:inicio as timestamp) is null or r.dataVenda >= :inicio)
          and (cast(:fim as timestamp) is null or r.dataVenda < :fim)
        """)
    Page<RecebivelEntity> listarPagina(Long empresaId, StatusRecebivel status, TipoFormaPagamento tipo,
            LocalDateTime inicio, LocalDateTime fim, Long vendaId, Pageable pageable);

    List<RecebivelEntity> findByEmpresaIdAndVendaIdOrderByIdAsc(Long empresaId, Long vendaId);

    interface Vinculos { Long getVendaId(); Long getPagamentoId(); }
    @Query("select r.venda.id as vendaId, r.pagamento.id as pagamentoId from RecebivelEntity r where r.id = :id and r.empresa.id = :empresaId")
    Optional<Vinculos> buscarVinculos(Long id, Long empresaId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from RecebivelEntity r where r.id = :id and r.empresa.id = :empresaId")
    Optional<RecebivelEntity> buscarParaLiquidar(Long id, Long empresaId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from RecebivelEntity r where r.empresa.id = :empresaId and r.venda.id = :vendaId order by r.id")
    List<RecebivelEntity> buscarParaCancelar(Long empresaId, Long vendaId);
}
