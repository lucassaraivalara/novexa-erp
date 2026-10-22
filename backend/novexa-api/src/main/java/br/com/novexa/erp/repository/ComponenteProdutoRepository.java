package br.com.novexa.erp.repository;
import br.com.novexa.erp.entity.ComponenteProdutoEntity;
import br.com.novexa.erp.entity.ProdutoEntity;
import org.springframework.data.jpa.repository.*;
import java.util.*;
public interface ComponenteProdutoRepository extends JpaRepository<ComponenteProdutoEntity,Long> {
    @Query("select count(c)>0 from ComponenteProdutoEntity c where c.empresa.id=:empresa and c.componente.id=:id and c.versao=c.produto.composicaoVersao")
    boolean usadoAtualmente(Long empresa,Long id);
    @Query("select distinct c.produto from ComponenteProdutoEntity c where c.empresa.id=:empresa and c.componente.id=:id and c.versao=c.produto.composicaoVersao order by c.produto.nome")
    List<ProdutoEntity> kitsQueUsamAtualmente(Long empresa,Long id);
    @Query("select c from ComponenteProdutoEntity c join fetch c.componente join fetch c.produto where c.empresa.id=:empresa and c.produto.id in :ids and c.versao=c.produto.composicaoVersao order by c.produto.id,c.componente.id")
    List<ComponenteProdutoEntity> atuais(Long empresa,Collection<Long> ids);
    List<ComponenteProdutoEntity> findByEmpresaIdAndProdutoIdOrderByVersaoDescIdAsc(Long empresaId,Long produtoId);
}
