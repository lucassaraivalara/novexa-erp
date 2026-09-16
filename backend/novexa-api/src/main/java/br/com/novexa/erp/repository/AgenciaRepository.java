package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.AgenciaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AgenciaRepository extends JpaRepository<AgenciaEntity, Long> {

    @Query("""
            select a from AgenciaEntity a
            join fetch a.banco b
            order by b.nome asc, b.numero asc, a.numero asc, a.id asc
            """)
    List<AgenciaEntity> listarOrdenadas();

    @Query("""
            select a from AgenciaEntity a
            join fetch a.banco b
            where b.id = :bancoId
            order by a.numero asc, a.id asc
            """)
    List<AgenciaEntity> listarPorBanco(@Param("bancoId") Long bancoId);

    boolean existsByBancoIdAndNumero(Long bancoId, String numero);

    boolean existsByBancoIdAndNumeroAndIdNot(Long bancoId, String numero, Long id);
}
