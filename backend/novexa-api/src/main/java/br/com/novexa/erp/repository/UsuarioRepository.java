package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.UsuarioEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<UsuarioEntity, Long> {

    List<UsuarioEntity> findAllByEmpresaId(Long empresaId);

    Optional<UsuarioEntity> findByIdAndEmpresaId(Long id, Long empresaId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from UsuarioEntity u where u.id = :id and u.empresa.id = :empresaId")
    Optional<UsuarioEntity> buscarComLock(@Param("id") Long id, @Param("empresaId") Long empresaId);

    // Verifica se já existe um usuário com o CPF informado.
    boolean existsByCpf(String cpf);

    // Busca um usuário pelo CPF.
    Optional<UsuarioEntity> findByCpf(String cpf);

    // Busca um usuário pelo CPF ignorando máscara.
    @Query(value = """
            select * from usuario
            where regexp_replace(cpf, '\\D', '', 'g') = :cpf
            limit 1
            """, nativeQuery = true)
    Optional<UsuarioEntity> findByCpfNormalizado(@Param("cpf") String cpf);

    // Verifica se existe outro usuário com esse CPF,
    // ignorando o usuário que está sendo atualizado.
    boolean existsByCpfAndIdNot(String cpf, Long id);
}
