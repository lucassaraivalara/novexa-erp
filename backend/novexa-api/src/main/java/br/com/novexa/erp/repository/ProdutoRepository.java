package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.ProdutoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;

public interface ProdutoRepository extends JpaRepository<ProdutoEntity, Long> {

    List<ProdutoEntity> findAllByEmpresaIdOrderByNomeAsc(Long empresaId);

    Optional<ProdutoEntity> findByIdAndEmpresaId(Long id, Long empresaId);

    @Query("""
            select count(produto)
            from ProdutoEntity produto
            where produto.empresa.id = :empresaId
              and produto.ativo = true
              and produto.controlaEstoque = true
              and produto.estoqueAtual <= produto.estoqueMinimo
            """)
    long contarEstoqueBaixo(@Param("empresaId") Long empresaId);

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

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from ProdutoEntity p where p.id = :id and p.empresa.id = :empresaId")
    Optional<ProdutoEntity> findByIdAndEmpresaIdWithLock(@Param("id") Long id, @Param("empresaId") Long empresaId);
}
