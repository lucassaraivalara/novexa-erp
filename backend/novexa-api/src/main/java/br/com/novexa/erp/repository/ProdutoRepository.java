package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.ProdutoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProdutoRepository extends JpaRepository<ProdutoEntity, Long> {

    List<ProdutoEntity> findAllByEmpresaIdOrderByNomeAsc(Long empresaId);

    Optional<ProdutoEntity> findByIdAndEmpresaId(Long id, Long empresaId);

    boolean existsByEmpresaIdAndCodigoInterno(Long empresaId, String codigoInterno);

    boolean existsByEmpresaIdAndCodigoInternoAndIdNot(
            Long empresaId,
            String codigoInterno,
            Long id
    );

    boolean existsByEmpresaIdAndCodigoBarras(Long empresaId, String codigoBarras);

    boolean existsByEmpresaIdAndCodigoBarrasAndIdNot(
            Long empresaId,
            String codigoBarras,
            Long id
    );

    @Query("""
            select produto
            from ProdutoEntity produto
            where produto.empresa.id = :empresaId
              and (
                    lower(produto.nome) like lower(concat('%', :termo, '%'))
                    or lower(produto.codigoInterno) = lower(:termo)
                    or produto.codigoBarras = :termo
              )
            order by produto.nome asc
            """)
    List<ProdutoEntity> buscarPorTermo(
            @Param("empresaId") Long empresaId,
            @Param("termo") String termo
    );
}
