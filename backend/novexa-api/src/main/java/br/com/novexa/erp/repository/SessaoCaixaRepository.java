package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.SessaoCaixaEntity;
import br.com.novexa.erp.entity.StatusSessaoCaixa;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface SessaoCaixaRepository extends JpaRepository<SessaoCaixaEntity, Long> {
    java.util.List<SessaoCaixaEntity> findByEmpresaIdAndStatusOrderByDataAberturaAscIdAsc(Long empresaId, StatusSessaoCaixa status);
    Optional<SessaoCaixaEntity> findByIdAndEmpresaId(Long id, Long empresaId);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select s from SessaoCaixaEntity s where s.id = :id and s.empresa.id = :empresaId")
    Optional<SessaoCaixaEntity> bloquear(Long id, Long empresaId);
    Optional<SessaoCaixaEntity> findByCaixaIdAndEmpresaIdAndStatus(Long caixaId, Long empresaId, StatusSessaoCaixa status);
    Optional<SessaoCaixaEntity> findByIdAndCaixaIdAndEmpresaId(Long id, Long caixaId, Long empresaId);
}
