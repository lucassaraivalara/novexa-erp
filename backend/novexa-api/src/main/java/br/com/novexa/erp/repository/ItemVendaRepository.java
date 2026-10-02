package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.ItemVendaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ItemVendaRepository extends JpaRepository<ItemVendaEntity, Long> {
    java.util.Optional<ItemVendaEntity> findByIdAndVendaEmpresaId(Long id, Long empresaId);
    List<ItemVendaEntity> findByVendaId(Long vendaId);
}
