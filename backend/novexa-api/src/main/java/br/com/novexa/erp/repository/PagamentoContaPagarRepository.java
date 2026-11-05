package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.PagamentoContaPagarEntity;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.domain.*;
import java.util.Optional;
import java.util.UUID;

public interface PagamentoContaPagarRepository extends JpaRepository<PagamentoContaPagarEntity,Long> {
    Optional<PagamentoContaPagarEntity> findFirstByContaPagarIdAndEmpresaIdAndEstadoOrderByIdDesc(Long titulo,Long empresa,String estado);
    long countByContaPagarIdAndEmpresaIdAndEstado(Long titulo,Long empresa,String estado);
    Optional<PagamentoContaPagarEntity> findByEmpresaIdAndChaveRequisicao(Long empresaId,UUID chave);
    Optional<PagamentoContaPagarEntity> findByIdAndContaPagarIdAndEmpresaId(Long id,Long contaPagarId,Long empresaId);
    @EntityGraph(attributePaths={"usuario","usuarioEstorno"})
    Page<PagamentoContaPagarEntity> findByContaPagarIdAndEmpresaId(Long contaPagarId,Long empresaId,Pageable pagina);
}
