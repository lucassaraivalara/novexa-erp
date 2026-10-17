package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.SubcategoriaProdutoEntity;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface SubcategoriaProdutoRepository extends JpaRepository<SubcategoriaProdutoEntity, Long> {

    Optional<SubcategoriaProdutoEntity> findByIdAndEmpresaId(Long id, Long empresaId);
    boolean existsByEmpresaIdAndNomeIgnoreCaseAndIdNot(Long empresaId, String nome, Long id);
    boolean existsByCategoriaIdAndEmpresaId(Long categoriaId, Long empresaId);

    @EntityGraph(attributePaths = "categoria")
    @Query("""
            select s from SubcategoriaProdutoEntity s where s.empresa.id = :empresaId
              and (:ativo is null or s.ativo = :ativo) and lower(s.nome) like :termo escape '!'
              and (:categoriaId is null or s.categoria.id = :categoriaId)
            """)
    Page<SubcategoriaProdutoEntity> listar(@Param("empresaId") Long empresaId, @Param("termo") String termo,
            @Param("ativo") Boolean ativo, @Param("categoriaId") Long categoriaId, Pageable pageable);
}
