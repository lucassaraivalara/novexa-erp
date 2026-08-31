package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.ClienteEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ClienteRepository extends JpaRepository<ClienteEntity, Long> {

    List<ClienteEntity> findAllByEmpresaIdOrderByNomeAsc(Long empresaId);

    Optional<ClienteEntity> findByIdAndEmpresaId(Long id, Long empresaId);
}
