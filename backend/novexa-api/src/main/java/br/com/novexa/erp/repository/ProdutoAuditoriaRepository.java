package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.ProdutoAuditoriaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ProdutoAuditoriaRepository extends JpaRepository<ProdutoAuditoriaEntity, Long> {
    List<ProdutoAuditoriaEntity> findByEmpresaIdAndProdutoIdOrderByDataHoraDescIdDesc(Long empresaId, Long produtoId);
}
