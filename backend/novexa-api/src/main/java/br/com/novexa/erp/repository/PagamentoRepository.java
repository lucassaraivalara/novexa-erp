package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.PagamentoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PagamentoRepository extends JpaRepository<PagamentoEntity, Long> {
    List<PagamentoEntity> findByEmpresaIdAndVendaIdOrderBySequenciaAsc(Long empresaId, Long vendaId);
}
