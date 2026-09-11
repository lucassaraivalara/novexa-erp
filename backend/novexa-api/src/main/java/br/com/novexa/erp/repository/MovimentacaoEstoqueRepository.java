package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.MovimentacaoEstoqueEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MovimentacaoEstoqueRepository extends JpaRepository<MovimentacaoEstoqueEntity, Long> {

    List<MovimentacaoEstoqueEntity> findByEmpresaIdAndProdutoIdOrderByDataHoraDesc(Long empresaId, Long produtoId);
}