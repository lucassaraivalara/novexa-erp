package br.com.novexa.erp.repository;
import br.com.novexa.erp.entity.ConsumoKitVendaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface ConsumoKitVendaRepository extends JpaRepository<ConsumoKitVendaEntity,Long> {
    @org.springframework.data.jpa.repository.Query("select c.movimentoId,c.reversaoId,c.vendaId,c.item.produto.id from ConsumoKitVendaEntity c where c.empresaId=:empresa and c.componente.id=:produto and (c.movimentoId in :ids or c.reversaoId in :ids)")
    List<Object[]> origens(Long empresa,Long produto,java.util.Collection<Long> ids);
    List<ConsumoKitVendaEntity> findByEmpresaIdAndVendaIdOrderByIdAsc(Long empresaId,Long vendaId);
}
