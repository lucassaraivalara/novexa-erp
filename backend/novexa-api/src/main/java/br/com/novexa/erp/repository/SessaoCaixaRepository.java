package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.SessaoCaixaEntity;
import br.com.novexa.erp.entity.StatusSessaoCaixa;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface SessaoCaixaRepository extends JpaRepository<SessaoCaixaEntity, Long> {
    Optional<SessaoCaixaEntity> findByCaixaIdAndEmpresaIdAndStatus(Long caixaId, Long empresaId, StatusSessaoCaixa status);
    Optional<SessaoCaixaEntity> findByIdAndCaixaIdAndEmpresaId(Long id, Long caixaId, Long empresaId);
}
