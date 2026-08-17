package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.EmpresaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmpresaRepository extends JpaRepository<EmpresaEntity, Long> {

    // Verifica se já existe uma empresa com o CNPJ informado.
    boolean existsByCnpj(String cnpj);

    // Verifica se existe outra empresa com esse CNPJ,
    // ignorando a empresa que está sendo atualizada.
    boolean existsByCnpjAndIdNot(String cnpj, Long id);
}