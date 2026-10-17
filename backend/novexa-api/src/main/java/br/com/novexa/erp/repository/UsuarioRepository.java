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
    @Query("select u from UsuarioEntity u where u.empresa.id = :empresaId order by u.id")
    List<UsuarioEntity> bloquearAdministracao(@Param("empresaId") Long empresaId);

    long countByEmpresaIdAndPerfilAndAtivoTrue(Long empresaId, br.com.novexa.erp.entity.PerfilUsuario perfil);

    @Query("select count(u) > 0 from UsuarioEntity u where u.empresa.id = :empresaId and u.id <> :id " +
            "and lower(trim(u.login)) = :login")
    boolean loginEmUso(Long empresaId, Long id, String login);

    @Query("select count(u) > 0 from UsuarioEntity u where u.empresa.id = :empresaId and u.id <> :id " +
            "and lower(trim(u.email)) = :email")
    boolean emailEmUso(Long empresaId, Long id, String email);

    @Query("select u from UsuarioEntity u where u.empresa.id = :empresaId " +
            "and (:ativo is null or u.ativo = :ativo) and (lower(u.nomeUsuario) like :busca escape '!' " +
            "or lower(u.login) like :busca escape '!' or lower(u.email) like :busca escape '!' " +
            "or replace(replace(u.cpf, '.', ''), '-', '') like :documento escape '!')")
    org.springframework.data.domain.Page<UsuarioEntity> listarPagina(Long empresaId, String busca,
            String documento, Boolean ativo, org.springframework.data.domain.Pageable pagina);

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
