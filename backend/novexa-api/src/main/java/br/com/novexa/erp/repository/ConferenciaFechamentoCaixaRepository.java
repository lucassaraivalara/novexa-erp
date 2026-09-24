package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.ConferenciaFechamentoCaixaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ConferenciaFechamentoCaixaRepository extends JpaRepository<ConferenciaFechamentoCaixaEntity, Long> {
    List<ConferenciaFechamentoCaixaEntity> findBySessaoIdAndEmpresaIdOrderByIdAsc(Long sessaoId, Long empresaId);
}
