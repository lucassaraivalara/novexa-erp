package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.EmpresaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmpresaRepository extends JpaRepository<EmpresaEntity, Long> {

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
