package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.RecolhimentoCofreEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface RecolhimentoCofreRepository extends JpaRepository<RecolhimentoCofreEntity,Long> {
    Optional<RecolhimentoCofreEntity> findByIdAndEmpresaId(Long id, Long empresaId);
    Optional<RecolhimentoCofreEntity> findByEmpresaIdAndChaveRequisicao(Long empresaId, UUID chave);
    Optional<RecolhimentoCofreEntity> findBySessaoIdAndTipo(Long sessaoId, String tipo);
    Optional<RecolhimentoCofreEntity> findByMovimentoCaixaId(Long id);
}
