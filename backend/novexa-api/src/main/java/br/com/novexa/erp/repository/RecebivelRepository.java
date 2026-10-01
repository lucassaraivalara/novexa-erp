package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import java.time.LocalDateTime;
import java.util.List;

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
}
