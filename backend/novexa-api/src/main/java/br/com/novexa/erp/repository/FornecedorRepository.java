package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.FornecedorEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FornecedorRepository extends JpaRepository<FornecedorEntity, Long> {

    List<FornecedorEntity> findAllByEmpresaIdOrderByRazaoSocialAsc(Long empresaId);

    Optional<FornecedorEntity> findByIdAndEmpresaId(Long id, Long empresaId);

    @Query("""
            select (count(f) > 0) from FornecedorEntity f
            where f.empresa.id = :empresaId
              and cast(function('regexp_replace', f.cpfCnpj, '[^0-9]', '', 'g') as string) = :documento
              and (:id is null or f.id <> :id)
            """)
    boolean documentoJaCadastrado(@Param("empresaId") Long empresaId, @Param("documento") String documento, @Param("id") Long id);

    String CONSULTA = """
            select f from FornecedorEntity f
            where f.empresa.id = :empresaId
              and (:ativo is null or f.ativo = :ativo)
              and (lower(f.razaoSocial) like lower(:termo) escape '!'
                or lower(f.nomeFantasia) like lower(:termo) escape '!'
                or (:documento is not null and cast(function('regexp_replace', f.cpfCnpj, '[^0-9]', '', 'g') as string) like :documento))
            """;

    @Query(CONSULTA)
    Page<FornecedorEntity> listarPagina(@Param("empresaId") Long empresaId, @Param("ativo") Boolean ativo,
            @Param("termo") String termo, @Param("documento") String documento, Pageable pageable);

    @Query(CONSULTA)
    List<FornecedorEntity> buscarPorTermo(@Param("empresaId") Long empresaId, @Param("ativo") Boolean ativo,
            @Param("termo") String termo, @Param("documento") String documento, Pageable pageable);
}
