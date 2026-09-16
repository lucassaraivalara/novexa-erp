package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.BancoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BancoRepository extends JpaRepository<BancoEntity, Long> {

    List<BancoEntity> findAllByOrderByNomeAscNumeroAsc();

    boolean existsByNumero(String numero);

    boolean existsByNumeroAndIdNot(String numero, Long id);
}
