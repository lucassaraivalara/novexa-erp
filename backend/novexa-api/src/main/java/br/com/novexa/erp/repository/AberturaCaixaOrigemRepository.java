package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.AberturaCaixaOrigemEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface AberturaCaixaOrigemRepository extends JpaRepository<AberturaCaixaOrigemEntity, Long> {
    Optional<AberturaCaixaOrigemEntity> findBySessaoId(Long sessaoId);
    Optional<AberturaCaixaOrigemEntity> findByEmpresaIdAndChaveRequisicao(Long empresaId, UUID chaveRequisicao);
    boolean existsBySessaoOrigemTrocoId(Long sessaoOrigemTrocoId);
    Optional<AberturaCaixaOrigemEntity> findBySessaoOrigemTrocoId(Long sessaoOrigemTrocoId);
}
