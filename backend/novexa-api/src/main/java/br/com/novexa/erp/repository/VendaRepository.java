package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.*;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VendaRepository extends JpaRepository<VendaEntity, Long> {
    Optional<VendaEntity> findByEmpresaIdAndUsuarioIdAndChaveRequisicao(Long empresaId, Long usuarioId, UUID chave);
    Optional<VendaEntity> findByIdAndEmpresaId(Long id, Long empresaId);

    // Serializa finalizações do mesmo operador, inclusive tentativas simultâneas da mesma requisição.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from UsuarioEntity u where u.id = :usuarioId and u.empresa.id = :empresaId")
    Optional<UsuarioEntity> bloquearOperador(@Param("usuarioId") Long usuarioId, @Param("empresaId") Long empresaId);

    // Ordem estável evita deadlocks entre carrinhos com os mesmos produtos.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from ProdutoEntity p where p.empresa.id = :empresaId and p.id in :ids order by p.id")
    List<ProdutoEntity> bloquearProdutos(@Param("empresaId") Long empresaId, @Param("ids") List<Long> ids);
}
