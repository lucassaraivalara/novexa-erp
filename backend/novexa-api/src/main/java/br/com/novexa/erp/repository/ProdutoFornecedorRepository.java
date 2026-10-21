package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.ProdutoFornecedorEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface ProdutoFornecedorRepository extends JpaRepository<ProdutoFornecedorEntity, Long> {

    List<ProdutoFornecedorEntity> findByProdutoIdAndEmpresaId(Long produtoId, Long empresaId);

    // Join fetch do fornecedor: o grid sempre exibe razaoSocial do vínculo; evita N+1 por linha.
    @Query("select v from ProdutoFornecedorEntity v join fetch v.fornecedor " +
            "where v.produto.id in :produtoIds and v.empresa.id = :empresaId")
    List<ProdutoFornecedorEntity> findByProdutoIdInAndEmpresaId(@Param("produtoIds") Collection<Long> produtoIds,
                                                                @Param("empresaId") Long empresaId);

    void deleteByProdutoIdAndEmpresaId(Long produtoId, Long empresaId);

    java.util.Optional<ProdutoFornecedorEntity> findByProdutoIdAndFornecedorIdAndEmpresaId(
            Long produtoId, Long fornecedorId, Long empresaId);

    java.util.Optional<ProdutoFornecedorEntity> findByEmpresaIdAndFornecedorIdAndCodigoReferencia(
            Long empresaId, Long fornecedorId, String codigoReferencia);
}
