package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.ContaFinanceiraEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import java.util.List;
import java.util.Optional;

public interface ContaFinanceiraRepository extends JpaRepository<ContaFinanceiraEntity, Long> {
    @EntityGraph(attributePaths = {"contaBancaria.agencia.banco"})
    List<ContaFinanceiraEntity> findByEmpresaIdOrderByNomeAscIdAsc(Long empresaId);

    @EntityGraph(attributePaths = {"contaBancaria.agencia.banco"})
    @Query("select c from ContaFinanceiraEntity c where c.empresa.id = :empresaId " +
            "and (:ativo is null or c.ativo = :ativo) and (:tipo is null or c.tipo = :tipo) " +
            "and (:termo is null or lower(c.nome) like lower(concat('%', :termo, '%')) " +
            "or lower(replace(cast(c.tipo as string), '_', ' ')) like lower(concat('%', :termo, '%')))")
    org.springframework.data.domain.Page<ContaFinanceiraEntity> listarPagina(Long empresaId, String termo,
            Boolean ativo, br.com.novexa.erp.entity.TipoContaFinanceira tipo,
            org.springframework.data.domain.Pageable pageable);

    @Query("select new br.com.novexa.erp.dto.ContaFinanceiraResumoDTO(c.tipo, count(c), sum(c.saldoAtual)) " +
            "from ContaFinanceiraEntity c where c.empresa.id = :empresaId group by c.tipo")
    List<br.com.novexa.erp.dto.ContaFinanceiraResumoDTO> resumir(Long empresaId);
    @Query("select count(c) > 0 from ContaFinanceiraEntity c where c.contaBancaria.id = :bancariaId and (:idIgnorado is null or c.id <> :idIgnorado)")
    boolean existeVinculoBancario(Long bancariaId, Long idIgnorado);
    boolean existsByIdAndEmpresaId(Long id, Long empresaId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ContaFinanceiraEntity c where c.id = :id and c.empresa.id = :empresaId")
    Optional<ContaFinanceiraEntity> buscarParaAlterar(Long id, Long empresaId);
}
