package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.FornecedorEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FornecedorRepository extends JpaRepository<FornecedorEntity, Long> {

    List<FornecedorEntity> findAllByEmpresaIdOrderByRazaoSocialAsc(Long empresaId);

    Optional<FornecedorEntity> findByIdAndEmpresaId(Long id, Long empresaId);
}
