package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.FormaPagamentoEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import java.util.List;
import java.util.Optional;

public interface FormaPagamentoRepository extends JpaRepository<FormaPagamentoEntity, Long> {
    List<FormaPagamentoEntity> findAllByOrderByDescricaoAsc();
    boolean existsByDescricaoIgnoreCase(String descricao);
    boolean existsByDescricaoIgnoreCaseAndIdNot(String descricao, Long id);

    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("select f from FormaPagamentoEntity f where f.id = :id")
    Optional<FormaPagamentoEntity> buscarParaPagamento(Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select f from FormaPagamentoEntity f where f.id = :id")
    Optional<FormaPagamentoEntity> buscarParaAtualizar(Long id);
}
