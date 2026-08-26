package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.UsuarioEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UsuarioRepository extends JpaRepository<UsuarioEntity, Long> {

    // Verifica se já existe um usuário com o CPF informado.
    boolean existsByCpf(String cpf);

    // Verifica se existe outro usuário com esse CPF,
    // ignorando o usuário que está sendo atualizado.
    boolean existsByCpfAndIdNot(String cpf, Long id);
}