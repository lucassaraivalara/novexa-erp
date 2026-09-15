package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.CaixaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CaixaRepository extends JpaRepository<CaixaEntity, Long> {

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from CaixaEntity c where c.id = :id and c.empresa.id = :empresaId")
    Optional<CaixaEntity> buscarComLock(@Param("id") Long id, @Param("empresaId") Long empresaId);

    List<CaixaEntity> findAllByEmpresaIdOrderByDescricaoAsc(Long empresaId);

    Optional<CaixaEntity> findByIdAndEmpresaId(Long id, Long empresaId);

    @Query("""
            select caixa
            from CaixaEntity caixa
            where caixa.empresa.id = :empresaId
              and lower(trim(caixa.descricao)) = lower(:descricao)
            """)
    Optional<CaixaEntity> findByEmpresaIdAndDescricaoNormalizada(
            @Param("empresaId") Long empresaId,
            @Param("descricao") String descricao
    );

    @Query("""
            select caixa
            from CaixaEntity caixa
            where caixa.empresa.id = :empresaId
              and lower(trim(caixa.descricao)) = lower(:descricao)
              and caixa.id <> :idIgnorado
            """)
    Optional<CaixaEntity> findByEmpresaIdAndDescricaoNormalizadaAndIdNot(
            @Param("empresaId") Long empresaId,
            @Param("descricao") String descricao,
            @Param("idIgnorado") Long idIgnorado
    );
}
