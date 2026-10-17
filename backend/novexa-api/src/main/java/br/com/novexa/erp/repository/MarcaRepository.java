package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.MarcaEntity;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface MarcaRepository extends JpaRepository<MarcaEntity, Long> {
    @Query("select c from MarcaEntity c where c.empresa.id=:empresaId and lower(c.nome) in :nomes")
    java.util.List<MarcaEntity> buscarNomesImportacao(Long empresaId, java.util.Collection<String> nomes);

    Optional<MarcaEntity> findByIdAndEmpresaId(Long id, Long empresaId);
    boolean existsByEmpresaIdAndNomeIgnoreCaseAndIdNot(Long empresaId, String nome, Long id);

    @Query("""
            select m from MarcaEntity m where m.empresa.id = :empresaId
              and (:ativo is null or m.ativo = :ativo) and lower(m.nome) like :termo escape '!'
            """)
    Page<MarcaEntity> listar(@Param("empresaId") Long empresaId, @Param("termo") String termo,
                            @Param("ativo") Boolean ativo, Pageable pageable);
}
