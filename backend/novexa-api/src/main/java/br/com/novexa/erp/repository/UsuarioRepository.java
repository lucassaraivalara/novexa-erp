package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.UsuarioEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UsuarioRepository extends JpaRepository<UsuarioEntity, Long> {

    // Verifica se já existe um usuário com o CPF informado.
    boolean existsByCpf(String cpf);

    // Busca um usuário pelo CPF.
    java.util.Optional<UsuarioEntity> findByCpf(String cpf);

    // Busca um usuário pelo CPF ignorando máscara.
    @Query(value = """
            select * from usuario
            where regexp_replace(cpf, '\\D', '', 'g') = :cpf
            limit 1
            """, nativeQuery = true)
    java.util.Optional<UsuarioEntity> findByCpfNormalizado(@Param("cpf") String cpf);

    // Verifica se existe outro usuário com esse CPF,
    // ignorando o usuário que está sendo atualizado.
    boolean existsByCpfAndIdNot(String cpf, Long id);
}
