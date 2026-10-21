package br.com.novexa.erp.service;
import br.com.novexa.erp.dto.*;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.*;
@Service
@Transactional(readOnly=true)
public class AgendaRecebimentosService {
    private final EntityManager em;
    public AgendaRecebimentosService(EntityManager em) { this.em=em; }
    private static final String BASE="""
        from recebiveis r join pagamentos p on p.id=r.pagamento_id and p.empresa_id=r.empresa_id
        join vendas v on v.id=r.venda_id and v.empresa_id=r.empresa_id
        where r.empresa_id=:empresa and r.status='PENDENTE' and p.status='REGISTRADO' and v.status='FATURADA'
        """;
    private static final String GRUPO="""
        group by r.data_prevista_recebimento,r.configuracao_forma_pagamento_id,r.tipo,p.configuracao_conta_financeira_destino_id
        """;
    public PaginaResponseDTO<AgendaRecebimentosDTO> listar(Long empresa,int page,int size) {
        validarPagina(page,size);
        var total=((Number)em.createNativeQuery("select count(*) from (select 1 "+BASE+GRUPO+") grupos")
                .setParameter("empresa",empresa).getSingleResult()).longValue();
        var query=em.createNativeQuery("""
            select r.data_prevista_recebimento,r.configuracao_forma_pagamento_id,min(r.configuracao_nome_exibicao),r.tipo,
            p.configuracao_conta_financeira_destino_id,min(p.configuracao_conta_financeira_destino_nome),count(*),
            sum(r.valor_bruto),sum(r.valor_taxas_previsto),sum(r.valor_liquido_previsto),
            sum(case when r.valor_liquido_previsto is null then 1 else 0 end)
            """+BASE+GRUPO+" order by r.data_prevista_recebimento nulls first,r.configuracao_forma_pagamento_id nulls first,r.tipo,p.configuracao_conta_financeira_destino_id nulls first")
                .setParameter("empresa",empresa).setFirstResult(page*size).setMaxResults(size);
        @SuppressWarnings("unchecked") List<Object[]> rows=query.getResultList();
        var items=rows.stream().map(r -> new AgendaRecebimentosDTO(r[0]==null?null:((java.sql.Date)r[0]).toLocalDate(),numero(r[1]),(String)r[2],(String)r[3],
                numero(r[4]),(String)r[5],((Number)r[6]).longValue(),(BigDecimal)r[7],(BigDecimal)r[8],(BigDecimal)r[9],((Number)r[10]).longValue())).toList();
        return new PaginaResponseDTO<>(items,page,size,total,(int)((total+size-1)/size));
    }
    public PaginaResponseDTO<AgendaItemDTO> itens(Long empresa,LocalDate data,Long configuracao,String tipo,Long destino,int page,int size) {
        validarPagina(page,size);
        if (!Set.of("DEBITO","CREDITO").contains(tipo)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Informe Débito ou Crédito.");
        String filtro="""
            and r.data_prevista_recebimento is not distinct from cast(:data as date)
            and r.configuracao_forma_pagamento_id is not distinct from cast(:configuracao as bigint)
            and r.tipo=cast(:tipo as varchar)
            and p.configuracao_conta_financeira_destino_id is not distinct from cast(:destino as bigint)
            """;
        var count=em.createNativeQuery("select count(*) "+BASE+filtro);
        var query=em.createNativeQuery("select r.id,r.venda_id,r.valor_bruto,r.valor_taxas_previsto,r.valor_liquido_previsto "+BASE+filtro+" order by r.id");
        for (var q:List.of(count,query)) q.setParameter("empresa",empresa).setParameter("data",data)
                .setParameter("configuracao",configuracao).setParameter("tipo",tipo).setParameter("destino",destino);
        long total=((Number)count.getSingleResult()).longValue();
        @SuppressWarnings("unchecked") List<Object[]> rows=query.setFirstResult(page*size).setMaxResults(size).getResultList();
        return new PaginaResponseDTO<>(rows.stream().map(r -> new AgendaItemDTO(numero(r[0]),numero(r[1]),(BigDecimal)r[2],(BigDecimal)r[3],(BigDecimal)r[4])).toList(),page,size,total,(int)((total+size-1)/size));
    }
    private Long numero(Object value) { return value==null?null:((Number)value).longValue(); }
    private void validarPagina(int page,int size) {
        if (page<0 || page>100000 || size<1 || size>200) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Paginação inválida.");
    }
}
