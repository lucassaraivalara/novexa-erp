package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.EmpresaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmpresaRepository extends JpaRepository<EmpresaEntity, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_READ)
    @org.springframework.data.jpa.repository.Query("select e from EmpresaEntity e where e.id = :id")
    java.util.Optional<EmpresaEntity> politicaComLock(Long id);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select e from EmpresaEntity e where e.id = :id")
    java.util.Optional<EmpresaEntity> politicaParaAlterar(Long id);


    // Busca ausente vira null no service; o cast evita lower(bytea) no PostgreSQL.
    @Query("select e from EmpresaEntity e where e.id = :empresaId " +
            "and (:ativo is null or e.ativo = :ativo) " +
            "and (cast(:termo as string) is null or lower(e.razaoSocial) like lower(concat('%', cast(:termo as string), '%')) " +
            "or lower(e.nomeFantasia) like lower(concat('%', cast(:termo as string), '%')) " +
            "or lower(replace(replace(replace(replace(e.cnpj, '.', ''), '/', ''), '-', ''), ' ', '')) " +
            "like lower(concat('%', cast(:documento as string), '%')))")
    org.springframework.data.domain.Page<EmpresaEntity> listarPagina(Long empresaId, String termo,
            String documento, Boolean ativo, org.springframework.data.domain.Pageable pageable);

    // Verifica se já existe uma empresa com o CNPJ informado.
    boolean existsByCnpj(String cnpj);

    // Verifica se existe outra empresa com esse CNPJ,
    // ignorando a empresa que está sendo atualizada.
    boolean existsByCnpjAndIdNot(String cnpj, Long id);

    // Também reconhece documentos antigos gravados com pontuação.
    @Query("select count(e) > 0 from EmpresaEntity e where " +
            "upper(replace(replace(replace(replace(e.cnpj, '.', ''), '/', ''), '-', ''), ' ', '')) = :documento " +
            "and (:id is null or e.id <> :id)")
    boolean documentoEmUso(@Param("documento") String documento, @Param("id") Long id);
}
