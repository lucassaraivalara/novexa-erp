package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.ClienteEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ClienteRepository extends JpaRepository<ClienteEntity, Long> {

    @Query("""
            select c from ClienteEntity c
            where c.empresa.id = :empresaId and (:incluirInativos = true or c.ativo = true)
              and (lower(c.nome) like lower(concat('%', :termo, '%'))
                or lower(c.nomeFantasia) like lower(concat('%', :termo, '%'))
                or (:documento <> '' and c.cpfCnpj like concat('%', :documento, '%')))
            order by c.nome asc, c.id asc
            """)
    List<ClienteEntity> buscarPorTermo(@Param("empresaId") Long empresaId,
            @Param("termo") String termo, @Param("documento") String documento,
            @Param("incluirInativos") boolean incluirInativos, Pageable pageable);

    List<ClienteEntity> findAllByEmpresaIdOrderByNomeAsc(Long empresaId);

    Optional<ClienteEntity> findByIdAndEmpresaId(Long id, Long empresaId);

    long countByEmpresaIdAndAtivoTrue(Long empresaId);

    @Query("""
            select c from ClienteEntity c
            where c.empresa.id = :empresaId
              and (:ativo is null or c.ativo = :ativo)
              and (:busca is null or (
                  ((:campoBusca is null or :campoBusca = 'id') and cast(c.id as string) like concat('%', :busca, '%'))
                  or ((:campoBusca is null or :campoBusca = 'nome') and lower(c.nome) like lower(concat('%', :busca, '%')))
                  or ((:campoBusca is null or :campoBusca = 'nomeFantasia') and lower(c.nomeFantasia) like lower(concat('%', :busca, '%')))
                  or ((:campoBusca is null or :campoBusca = 'cpfCnpj') and lower(c.cpfCnpj) like lower(concat('%', :busca, '%')))
                  or ((:campoBusca is null or :campoBusca = 'telefone') and lower(c.telefone) like lower(concat('%', :busca, '%')))
                  or ((:campoBusca is null or :campoBusca = 'cidadeUf') and exists (select 1 from c.enderecos e where lower(concat(e.cidade, ' / ', e.uf)) like lower(concat('%', :busca, '%'))))
              ))
            order by
                case when :sortCampo = 'id' and :sortDirecao = 'asc' then c.id end asc,
                case when :sortCampo = 'id' and :sortDirecao = 'desc' then c.id end desc,
                case when :sortCampo = 'nome' and :sortDirecao = 'asc' then c.nome end asc,
                case when :sortCampo = 'nome' and :sortDirecao = 'desc' then c.nome end desc,
                case when :sortCampo = 'nomeFantasia' and :sortDirecao = 'asc' then c.nomeFantasia end asc,
                case when :sortCampo = 'nomeFantasia' and :sortDirecao = 'desc' then c.nomeFantasia end desc,
                case when :sortCampo = 'cpfCnpj' and :sortDirecao = 'asc' then c.cpfCnpj end asc,
                case when :sortCampo = 'cpfCnpj' and :sortDirecao = 'desc' then c.cpfCnpj end desc,
                case when :sortCampo = 'cidadeUf' and :sortDirecao = 'asc' then coalesce((select min(concat(e.cidade, ' / ', e.uf)) from c.enderecos e where e.principal = true), (select concat(e.cidade, ' / ', e.uf) from c.enderecos e where index(e) = 0)) end asc,
                case when :sortCampo = 'cidadeUf' and :sortDirecao = 'desc' then coalesce((select min(concat(e.cidade, ' / ', e.uf)) from c.enderecos e where e.principal = true), (select concat(e.cidade, ' / ', e.uf) from c.enderecos e where index(e) = 0)) end desc,
                case when :sortCampo = 'telefone' and :sortDirecao = 'asc' then c.telefone end asc,
                case when :sortCampo = 'telefone' and :sortDirecao = 'desc' then c.telefone end desc,
                case when :sortCampo = 'ativo' and :sortDirecao = 'asc' then c.ativo end asc,
                case when :sortCampo = 'ativo' and :sortDirecao = 'desc' then c.ativo end desc,
                c.id asc
            """)
    Page<ClienteEntity> findAllPaginado(
            @Param("empresaId") Long empresaId,
            @Param("ativo") Boolean ativo,
            @Param("busca") String busca,
            @Param("campoBusca") String campoBusca,
            @Param("sortCampo") String sortCampo,
            @Param("sortDirecao") String sortDirecao,
            Pageable pageable);
}
