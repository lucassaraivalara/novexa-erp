package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.ConfiguracaoFormaPagamentoEmpresaEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import java.util.List;
import java.util.Optional;

public interface ConfiguracaoFormaPagamentoEmpresaRepository extends JpaRepository<ConfiguracaoFormaPagamentoEmpresaEntity, Long> {
    @EntityGraph(attributePaths = {"formaPagamento", "contaFinanceiraDestino"})
    @Query("select c from ConfiguracaoFormaPagamentoEmpresaEntity c where c.empresa.id = :empresaId and (:ativo is null or c.ativo = :ativo) order by c.nomeExibicao, c.id")
    List<ConfiguracaoFormaPagamentoEmpresaEntity> listar(Long empresaId, Boolean ativo);

    @EntityGraph(attributePaths = {"formaPagamento", "contaFinanceiraDestino"})
    Optional<ConfiguracaoFormaPagamentoEmpresaEntity> findByIdAndEmpresaId(Long id, Long empresaId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ConfiguracaoFormaPagamentoEmpresaEntity c where c.id = :id and c.empresa.id = :empresaId")
    Optional<ConfiguracaoFormaPagamentoEmpresaEntity> buscarParaAtualizar(Long id, Long empresaId);

    @Query("select count(c) > 0 from ConfiguracaoFormaPagamentoEmpresaEntity c where c.empresa.id = :empresaId and c.nomeNormalizado = lower(trim(:nome)) and (:id is null or c.id <> :id)")
    boolean existeNome(Long empresaId, String nome, Long id);
}
