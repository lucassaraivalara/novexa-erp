package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.ItemVendaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ItemVendaRepository extends JpaRepository<ItemVendaEntity, Long> {
    List<ItemVendaEntity> findByVendaId(Long vendaId);
}
