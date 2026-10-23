package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.PagamentoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;

public interface PagamentoRepository extends JpaRepository<PagamentoEntity, Long> {
    interface ResumoCaixa {
        br.com.novexa.erp.entity.StatusPagamento getStatus();
        java.math.BigDecimal getValor();
        Long getConfiguracaoId();
        String getConfiguracaoNomeExibicao();
        br.com.novexa.erp.entity.TipoFormaPagamento getConfiguracaoTipo();
        br.com.novexa.erp.entity.FormaPagamento getFormaPagamento();
        Long getFormaId();
        String getFormaDescricao();
        br.com.novexa.erp.entity.TipoFormaPagamento getFormaTipo();
    }

    @Query("""
            select p.status as status, p.valor as valor,
                   p.configuracaoFormaPagamento.id as configuracaoId,
                   p.configuracaoNomeExibicao as configuracaoNomeExibicao,
                   p.configuracaoTipo as configuracaoTipo, p.formaPagamento as formaPagamento,
                   f.id as formaId, f.descricao as formaDescricao, f.tipo as formaTipo
            from PagamentoEntity p join p.forma f
            where p.empresa.id = :empresaId and p.venda.sessaoCaixa.id = :sessaoId
            order by p.id
            """)
    List<ResumoCaixa> resumirParaCaixa(Long empresaId, Long sessaoId);

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
