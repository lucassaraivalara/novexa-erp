package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.ContaPagarEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import java.util.List;
import java.util.Optional;

public interface ContaPagarRepository extends JpaRepository<ContaPagarEntity, Long> {
    @EntityGraph(attributePaths = {"fornecedor", "entradaMercadoria", "movimentacaoFinanceira", "pagamentoAtual"})
    Optional<ContaPagarEntity> findByIdAndEmpresaId(Long id, Long empresaId);
    boolean existsByIdAndEmpresaId(Long id, Long empresaId);
    interface Total {
        java.math.BigDecimal getTotal();
        long getQuantidade();
    }
    @Query("""
        select coalesce(sum(case when c.status = 'PAGA' then c.valorPago else c.valor - c.principalQuitado end), 0) as total,
               count(c) as quantidade
        from ContaPagarEntity c where c.empresa.id = :empresaId
          and (c.status = :status or (:status = 'ABERTA' and c.status = 'PARCIALMENTE_PAGA'))
          and (cast(:inicio as date) is null or (case when c.status = 'PAGA' then c.dataPagamento else c.dataVencimento end) >= :inicio)
          and (cast(:fim as date) is null or (case when c.status = 'PAGA' then c.dataPagamento else c.dataVencimento end) <= :fim)
        """)
    Total totalizar(Long empresaId, br.com.novexa.erp.entity.StatusContaPagar status, java.time.LocalDate inicio, java.time.LocalDate fim);

    @Query(value="""
        select coalesce(sum(p.total),0) as total, count(*) as quantidade from (
          select total_pago as total from pagamentos_conta_pagar
            where empresa_id=:empresaId and estado='CONFIRMADO' and data_pagamento between :inicio and :fim
          union all
          select valor_pago as total from contas_pagar c where empresa_id=:empresaId and status='PAGA'
            and pagamento_atual_id is null and data_pagamento between :inicio and :fim
        ) p
        """,nativeQuery=true)
    Total desembolsos(Long empresaId,java.time.LocalDate inicio,java.time.LocalDate fim);

    @Query("select distinct c.categoria from ContaPagarEntity c where c.empresa.id = :empresaId and c.categoria is not null order by c.categoria")
    List<String> categorias(Long empresaId);
    @EntityGraph(attributePaths = {"fornecedor", "entradaMercadoria", "movimentacaoFinanceira", "pagamentoAtual"})
    @org.springframework.data.jpa.repository.Query("""
        select c from ContaPagarEntity c left join c.fornecedor f where c.empresa.id = :empresaId
         and (:status is null or c.status = :status) and (:fornecedor is null or f.id = :fornecedor)
         and (:categoria is null or c.categoria = :categoria)
         and (cast(:vencimentoDe as date) is null or c.dataVencimento >= :vencimentoDe)
         and (cast(:vencimentoAte as date) is null or c.dataVencimento <= :vencimentoAte)
         and (cast(:emissaoDe as date) is null or c.dataEmissao >= :emissaoDe)
         and (cast(:emissaoAte as date) is null or c.dataEmissao <= :emissaoAte)
         and (:busca is null or lower(concat(c.descricao, ' ', coalesce(c.documento, ''), ' ', coalesce(f.razaoSocial, ''), ' ', coalesce(c.categoria, ''))) like lower(concat('%', :busca, '%')))
        """)
    org.springframework.data.domain.Page<ContaPagarEntity> listarPagina(Long empresaId, String busca, br.com.novexa.erp.entity.StatusContaPagar status, Long fornecedor, String categoria, java.time.LocalDate vencimentoDe, java.time.LocalDate vencimentoAte, java.time.LocalDate emissaoDe, java.time.LocalDate emissaoAte,
            org.springframework.data.domain.Pageable pageable);

    @EntityGraph(attributePaths = {"fornecedor", "entradaMercadoria", "movimentacaoFinanceira", "pagamentoAtual"})
    List<ContaPagarEntity> findByEmpresaIdOrderByDataVencimentoAscIdAsc(Long empresaId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ContaPagarEntity c left join fetch c.fornecedor where c.id = :id and c.empresa.id = :empresaId")
    Optional<ContaPagarEntity> buscarParaAlterar(Long id, Long empresaId);
}
