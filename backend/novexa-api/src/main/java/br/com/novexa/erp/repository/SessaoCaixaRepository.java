package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.SessaoCaixaEntity;
import br.com.novexa.erp.entity.StatusSessaoCaixa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import java.util.List;
import java.util.Optional;

public interface SessaoCaixaRepository extends JpaRepository<SessaoCaixaEntity, Long> {
    interface ResumoLeitura {
        Long getId();
        Long getEmpresaId();
        Long getCaixaId();
        String getDescricaoCaixa();
        StatusSessaoCaixa getStatus();
        java.math.BigDecimal getSaldoInicial();
        java.math.BigDecimal getSaldoFinal();
        java.time.LocalDateTime getDataAbertura();
        Long getUsuarioAberturaId();
        String getUsuarioAberturaNome();
    }

    @org.springframework.data.jpa.repository.Query("""
            select s.id as id, s.empresa.id as empresaId, s.caixa.id as caixaId,
              s.caixa.descricao as descricaoCaixa, s.status as status,
              s.saldoInicial as saldoInicial, s.saldoFinal as saldoFinal,
              s.dataAbertura as dataAbertura, s.usuarioAbertura.id as usuarioAberturaId,
              s.usuarioAbertura.nomeUsuario as usuarioAberturaNome
            from SessaoCaixaEntity s where s.id = :id and s.empresa.id = :empresaId
            """)
    Optional<ResumoLeitura> buscarResumoLeitura(Long id, Long empresaId);

    interface AcessoSessao {
        StatusSessaoCaixa getStatus();
        Long getUsuarioAberturaId();
    }

    @org.springframework.data.jpa.repository.Query("""
            select s.status as status, s.usuarioAbertura.id as usuarioAberturaId
            from SessaoCaixaEntity s where s.id = :id and s.empresa.id = :empresaId
            """)
    Optional<AcessoSessao> buscarAcesso(Long id, Long empresaId);

    boolean existsByIdAndEmpresaId(Long id, Long empresaId);

    @EntityGraph(attributePaths = {"caixa", "usuarioAbertura"})
    List<SessaoCaixaEntity> findByEmpresaIdAndStatusOrderByDataAberturaAscIdAsc(Long empresaId, StatusSessaoCaixa status);
    @EntityGraph(attributePaths = {"caixa", "usuarioAbertura", "usuarioFechamento"})
    List<SessaoCaixaEntity> findByEmpresaIdAndStatusOrderByDataFechamentoDescIdDesc(Long empresaId, StatusSessaoCaixa status);
    @EntityGraph(attributePaths = {"caixa", "usuarioAbertura"})
    List<SessaoCaixaEntity> findByEmpresaIdAndUsuarioAberturaIdAndStatus(Long empresaId, Long usuarioAberturaId, StatusSessaoCaixa status);
    Optional<SessaoCaixaEntity> findByIdAndEmpresaId(Long id, Long empresaId);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select s from SessaoCaixaEntity s where s.id = :id and s.empresa.id = :empresaId")
    Optional<SessaoCaixaEntity> bloquear(Long id, Long empresaId);
    Optional<SessaoCaixaEntity> findByCaixaIdAndEmpresaIdAndStatus(Long caixaId, Long empresaId, StatusSessaoCaixa status);
    Optional<SessaoCaixaEntity> findByIdAndCaixaIdAndEmpresaId(Long id, Long caixaId, Long empresaId);
    Optional<SessaoCaixaEntity> findFirstByCaixaIdAndEmpresaIdAndStatusOrderByDataFechamentoDescIdDesc(Long caixaId, Long empresaId, StatusSessaoCaixa status);
    boolean existsByCaixaIdAndEmpresaIdAndDataAberturaAfter(Long caixaId, Long empresaId, java.time.LocalDateTime data);
}
