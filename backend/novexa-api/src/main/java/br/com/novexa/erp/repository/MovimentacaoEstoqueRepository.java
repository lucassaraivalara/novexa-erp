package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.MovimentacaoEstoqueEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MovimentacaoEstoqueRepository extends JpaRepository<MovimentacaoEstoqueEntity, Long> {
    java.util.Optional<MovimentacaoEstoqueEntity> findByIdAndEmpresaId(Long id, Long empresaId);
    @org.springframework.data.jpa.repository.Query("""
        select m from MovimentacaoEstoqueEntity m where m.empresa.id = :empresaId and m.produto.id = :produtoId
         and (:tipo is null or m.tipo = :tipo) and (:origem is null or m.origem = :origem)
         and (cast(:inicio as timestamp) is null or m.dataHora >= :inicio)
         and (cast(:fim as timestamp) is null or m.dataHora < :fim)
        """)
    org.springframework.data.domain.Page<MovimentacaoEstoqueEntity> listarPagina(Long empresaId, Long produtoId, br.com.novexa.erp.entity.TipoMovimentacaoEstoque tipo, br.com.novexa.erp.entity.OrigemMovimentacaoEstoque origem, java.time.LocalDateTime inicio, java.time.LocalDateTime fim,
            org.springframework.data.domain.Pageable pageable);


    List<MovimentacaoEstoqueEntity> findByEmpresaIdAndProdutoIdOrderByDataHoraDesc(Long empresaId, Long produtoId);
}
