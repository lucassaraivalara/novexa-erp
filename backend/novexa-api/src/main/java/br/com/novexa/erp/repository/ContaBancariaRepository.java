package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.ContaBancariaEntity;
import br.com.novexa.erp.entity.TipoContaBancaria;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ContaBancariaRepository extends JpaRepository<ContaBancariaEntity, Long> {

    @Query("""
            select conta from ContaBancariaEntity conta
            join fetch conta.agencia agencia
            join fetch agencia.banco banco
            where conta.empresa.id = :empresaId
              and (:agenciaId is null or agencia.id = :agenciaId)
              and (:bancoId is null or banco.id = :bancoId)
              and (:tipo is null or conta.tipo = :tipo)
              and (:ativo is null or conta.ativo = :ativo)
            order by banco.nome asc, banco.numero asc, agencia.numero asc,
                     conta.numero asc, conta.digito asc, conta.id asc
            """)
    List<ContaBancariaEntity> listar(
            @Param("empresaId") Long empresaId,
            @Param("agenciaId") Long agenciaId,
            @Param("bancoId") Long bancoId,
            @Param("tipo") TipoContaBancaria tipo,
            @Param("ativo") Boolean ativo
    );

    @Query("""
            select conta from ContaBancariaEntity conta
            join fetch conta.agencia agencia
            join fetch agencia.banco
            where conta.id = :id
              and conta.empresa.id = :empresaId
            """)
    Optional<ContaBancariaEntity> buscarPorIdEEmpresa(
            @Param("id") Long id,
            @Param("empresaId") Long empresaId
    );

    @Query("""
            select count(conta) > 0 from ContaBancariaEntity conta
            where conta.empresa.id = :empresaId
              and conta.agencia.id = :agenciaId
              and conta.numero = :numero
              and coalesce(conta.digito, '') = coalesce(:digito, '')
              and (:idIgnorado is null or conta.id <> :idIgnorado)
            """)
    boolean existeDuplicada(
            @Param("empresaId") Long empresaId,
            @Param("agenciaId") Long agenciaId,
            @Param("numero") String numero,
            @Param("digito") String digito,
            @Param("idIgnorado") Long idIgnorado
    );
}
