package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.MovimentacaoCaixaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface MovimentacaoCaixaRepository extends JpaRepository<MovimentacaoCaixaEntity, Long> {
    Optional<MovimentacaoCaixaEntity> findByPagamentoIdAndTipoAndSessaoIdAndEmpresaId(Long pagamentoId, br.com.novexa.erp.entity.TipoMovimentacaoCaixa tipo, Long sessaoId, Long empresaId);
    Optional<MovimentacaoCaixaEntity> findBySessaoIdAndEmpresaIdAndChaveRequisicao(Long sessaoId, Long empresaId, UUID chave);
    List<MovimentacaoCaixaEntity> findBySessaoIdAndEmpresaIdOrderByIdAsc(Long sessaoId, Long empresaId);
}
