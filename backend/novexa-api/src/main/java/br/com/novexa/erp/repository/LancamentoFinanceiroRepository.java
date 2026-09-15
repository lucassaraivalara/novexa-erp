package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.LancamentoFinanceiroEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LancamentoFinanceiroRepository extends JpaRepository<LancamentoFinanceiroEntity, Long> {
    java.util.Optional<LancamentoFinanceiroEntity> findByVendaIdAndEmpresaId(Long vendaId, Long empresaId);
}
