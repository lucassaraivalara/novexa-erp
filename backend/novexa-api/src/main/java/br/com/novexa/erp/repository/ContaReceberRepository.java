package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.*;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

public interface ContaReceberRepository extends JpaRepository<ContaReceberEntity, Long> {
    @EntityGraph(attributePaths = "cliente")
    Optional<ContaReceberEntity> findByIdAndEmpresaId(Long id, Long empresaId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ContaReceberEntity c where c.id = :id and c.empresa.id = :empresaId")
    Optional<ContaReceberEntity> buscarParaAlterar(Long id, Long empresaId);

    @EntityGraph(attributePaths = "cliente")
    @Query("""
        select c from ContaReceberEntity c join c.cliente cliente where c.empresa.id = :empresaId
          and (:status is null or c.status = :status) and (:origem is null or c.origem = :origem)
          and (:clienteId is null or cliente.id = :clienteId)
          and (cast(:vencimentoDe as date) is null or c.dataVencimento >= :vencimentoDe)
          and (cast(:vencimentoAte as date) is null or c.dataVencimento <= :vencimentoAte)
          and (cast(:termo as string) is null or lower(c.descricao) like lower(concat('%', cast(:termo as string), '%'))
            or lower(cliente.nome) like lower(concat('%', cast(:termo as string), '%'))
            or (cast(:documento as string) is not null and cliente.cpfCnpj like concat('%', cast(:documento as string), '%')))
        """)
    Page<ContaReceberEntity> listarPagina(Long empresaId, String termo, String documento, StatusContaReceber status,
            Long clienteId, LocalDate vencimentoDe, LocalDate vencimentoAte, OrigemContaReceber origem, Pageable pageable);

    interface Total { BigDecimal getTotal(); long getQuantidade(); }
    @Query("""
        select coalesce(sum(c.valorOriginal - c.valorRecebido), 0) as total, count(c) as quantidade
        from ContaReceberEntity c where c.empresa.id = :empresaId and c.status in ('PENDENTE', 'PARCIAL')
          and (cast(:de as date) is null or c.dataVencimento >= :de)
          and (cast(:ate as date) is null or c.dataVencimento <= :ate)
        """)
    Total resumirAbertas(Long empresaId, LocalDate de, LocalDate ate);
}
