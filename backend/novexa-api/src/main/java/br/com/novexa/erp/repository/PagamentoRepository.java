package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.PagamentoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;

public interface PagamentoRepository extends JpaRepository<PagamentoEntity, Long> {
    @Query("select p.venda.id from PagamentoEntity p where p.id = :id and p.empresa.id = :empresaId")
    Optional<Long> buscarVendaId(Long id, Long empresaId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from PagamentoEntity p where p.empresa.id = :empresaId and p.venda.id = :vendaId order by p.id")
    List<PagamentoEntity> buscarParaCancelar(Long empresaId, Long vendaId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from PagamentoEntity p where p.id = :id and p.empresa.id = :empresaId")
    Optional<PagamentoEntity> buscarParaConfirmar(Long id, Long empresaId);
    List<PagamentoEntity> findByEmpresaIdAndVendaSessaoCaixaIdOrderByIdAsc(Long empresaId, Long sessaoId);
    List<PagamentoEntity> findByEmpresaIdAndVendaIdOrderBySequenciaAsc(Long empresaId, Long vendaId);
}
