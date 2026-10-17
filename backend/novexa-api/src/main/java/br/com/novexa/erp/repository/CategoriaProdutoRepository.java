package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.CategoriaProdutoEntity;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface CategoriaProdutoRepository extends JpaRepository<CategoriaProdutoEntity, Long> {

    Optional<CategoriaProdutoEntity> findByIdAndEmpresaId(Long id, Long empresaId);
    boolean existsByEmpresaIdAndNomeIgnoreCaseAndIdNot(Long empresaId, String nome, Long id);

    @Query("""
            select c from CategoriaProdutoEntity c where c.empresa.id = :empresaId
              and (:ativo is null or c.ativo = :ativo) and lower(c.nome) like :termo escape '!'
            """)
    Page<CategoriaProdutoEntity> listar(@Param("empresaId") Long empresaId, @Param("termo") String termo,
                                        @Param("ativo") Boolean ativo, Pageable pageable);
}
