package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.*;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EntradaMercadoriaRepository extends JpaRepository<EntradaMercadoriaEntity, Long> {
    interface VinculoMovimentacao {
        Long getEntradaId();
        Long getMovimentacaoEstoqueId();
        Long getMovimentacaoCancelamentoId();
    }

    @Query("""
        select i.entrada.id as entradaId, i.movimentacaoEstoqueId as movimentacaoEstoqueId,
               i.movimentacaoCancelamentoId as movimentacaoCancelamentoId
        from ItemEntradaMercadoriaEntity i
        where i.empresa.id = :empresaId and i.entrada.empresa.id = :empresaId and i.produto.id = :produtoId
          and (i.movimentacaoEstoqueId in :movimentoIds or i.movimentacaoCancelamentoId in :movimentoIds)
        """)
    List<VinculoMovimentacao> buscarVinculosMovimentacoes(Long empresaId, Long produtoId, List<Long> movimentoIds);

    Optional<EntradaMercadoriaEntity> findByIdAndEmpresaId(Long id, Long empresaId);
    boolean existsByEmpresaIdAndChaveAcessoNfe(Long empresaId, String chaveAcessoNfe);
    Optional<EntradaMercadoriaEntity> findByContaPagarIdAndEmpresaId(Long contaPagarId, Long empresaId);
    Optional<EntradaMercadoriaEntity> findByEmpresaIdAndUsuarioCadastroIdAndChaveRequisicao(Long empresaId, Long usuarioId, UUID chave);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from EntradaMercadoriaEntity e where e.id = :id and e.empresa.id = :empresaId")
    Optional<EntradaMercadoriaEntity> bloquear(Long id, Long empresaId);

    // Mesmo padrao de Venda: serializa retries de criacao do mesmo usuario.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from UsuarioEntity u where u.id = :usuarioId and u.empresa.id = :empresaId")
    Optional<UsuarioEntity> bloquearOperador(Long usuarioId, Long empresaId);

    @EntityGraph(attributePaths = "fornecedor")
    @Query("""
        select e from EntradaMercadoriaEntity e where e.empresa.id = :empresaId
          and (:status is null or e.status = :status) and (:origem is null or e.origem = :origem)
          and (:fornecedorId is null or e.fornecedor.id = :fornecedorId)
          and (cast(:inicio as date) is null or e.dataEntrada >= :inicio)
          and (cast(:fim as date) is null or e.dataEntrada <= :fim)
          and (lower(coalesce(e.numeroNota, '')) like lower(:termo) escape '!'
            or lower(e.fornecedor.razaoSocial) like lower(:termo) escape '!'
            or lower(coalesce(e.fornecedor.nomeFantasia, '')) like lower(:termo) escape '!')
        """)
    Page<EntradaMercadoriaEntity> listarPagina(Long empresaId, String termo, StatusEntradaMercadoria status,
            OrigemEntradaMercadoria origem, Long fornecedorId, LocalDate inicio, LocalDate fim, Pageable pageable);
}
