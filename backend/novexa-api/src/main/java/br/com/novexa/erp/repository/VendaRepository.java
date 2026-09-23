package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.*;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VendaRepository extends JpaRepository<VendaEntity, Long> {
    interface ResumoVendasHoje {
        BigDecimal getFaturamento();
        long getQuantidade();
    }

    Optional<VendaEntity> findByEmpresaIdAndUsuarioIdAndChaveRequisicao(Long empresaId, Long usuarioId, UUID chave);
    Optional<VendaEntity> findByIdAndEmpresaId(Long id, Long empresaId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select v from VendaEntity v where v.id = :id and v.empresa.id = :empresaId")
    Optional<VendaEntity> findByIdAndEmpresaIdWithLock(@Param("id") Long id, @Param("empresaId") Long empresaId);

    @Query("""
            select v from VendaEntity v
            left join fetch v.cliente
            left join fetch v.sessaoCaixa
            where v.empresa.id = :empresaId
              and (:status is null or v.status = :status)
              and (cast(:inicio as timestamp) is null or v.dataHora >= :inicio)
              and (cast(:fimExclusivo as timestamp) is null or v.dataHora < :fimExclusivo)
              and (:clienteId is null or v.cliente.id = :clienteId)
            order by v.dataHora desc, v.id desc
            """)
    List<VendaEntity> listarResumo(@Param("empresaId") Long empresaId,
                                   @Param("status") StatusVenda status,
                                   @Param("inicio") LocalDateTime inicio,
                                   @Param("fimExclusivo") LocalDateTime fimExclusivo,
                                   @Param("clienteId") Long clienteId);

    @Query("""
            select coalesce(sum(v.total), 0) as faturamento, count(v) as quantidade
            from VendaEntity v
            where v.empresa.id = :empresaId
              and v.status = :status
              and v.dataHora >= :inicio
              and v.dataHora < :fimExclusivo
            """)
    ResumoVendasHoje resumirPorPeriodo(@Param("empresaId") Long empresaId,
                                       @Param("status") StatusVenda status,
                                       @Param("inicio") LocalDateTime inicio,
                                       @Param("fimExclusivo") LocalDateTime fimExclusivo);


    // Serializa finalizações do mesmo operador, inclusive tentativas simultâneas da mesma requisição.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from UsuarioEntity u where u.id = :usuarioId and u.empresa.id = :empresaId")
    Optional<UsuarioEntity> bloquearOperador(@Param("usuarioId") Long usuarioId, @Param("empresaId") Long empresaId);

    // Ordem estável evita deadlocks entre carrinhos com os mesmos produtos.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from ProdutoEntity p where p.empresa.id = :empresaId and p.id in :ids order by p.id")
    List<ProdutoEntity> bloquearProdutos(@Param("empresaId") Long empresaId, @Param("ids") List<Long> ids);

    @Transactional
    @Modifying
    @Query("update VendaEntity v set v.status = :status where v.id = :id")
    void updateStatus(@Param("id") Long id, @Param("status") StatusVenda status);
}
