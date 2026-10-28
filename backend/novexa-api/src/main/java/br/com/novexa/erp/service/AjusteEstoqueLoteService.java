package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.AjusteEstoqueLoteDTO.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.time.TempoNovexa;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

@Service
public class AjusteEstoqueLoteService {
    public static final int LIMITE = 200;
    private final NamedParameterJdbcTemplate jdbc;
    private final EntityManager em;
    private final MovimentacaoEstoqueService movimentos;
    private final ObjectMapper json;

    public AjusteEstoqueLoteService(NamedParameterJdbcTemplate jdbc, EntityManager em,
            MovimentacaoEstoqueService movimentos, ObjectMapper json) {
        this.jdbc=jdbc; this.em=em; this.movimentos=movimentos; this.json=json;
    }

    @Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
    public Resultado previa(Pedido p, UsuarioAutenticado u) {
        autorizar(u); validarPedido(p, false);
        return avaliar(p, estados(u.empresaId(), ids(p)), null);
    }

    @Transactional
    public Resultado confirmar(Pedido p, UsuarioAutenticado u) {
        autorizar(u); validarPedido(p, true);
        jdbc.getJdbcTemplate().execute("SET LOCAL lock_timeout TO '5s'");
        String hash=hash(p);
        var args=new HashMap<String,Object>();
        args.put("empresa",u.empresaId()); args.put("usuario",u.usuarioId()); args.put("chave",p.chaveRequisicao());
        args.put("hash",hash); args.put("motivo",p.motivo().trim()); args.put("data",TempoNovexa.agora());
        // A unique row serializes even different operators submitting the same company/key.
        // An uncommitted reservation is invisible; any failure rolls it back with the movements.
        jdbc.update("""
            insert into ajustes_estoque_lote(empresa_id,usuario_id,chave_requisicao,resumo_requisicao,motivo,data_hora)
            values(:empresa,:usuario,:chave,:hash,:motivo,:data)
            on conflict(empresa_id,chave_requisicao) do nothing
            """,args);
        var registro=jdbc.queryForMap("select usuario_id,resumo_requisicao,resultado from ajustes_estoque_lote where empresa_id=:empresa and chave_requisicao=:chave for update",args);
        if (((Number)registro.get("usuario_id")).longValue()!=u.usuarioId() || !hash.equals(registro.get("resumo_requisicao")))
            throw conflito("Chave já utilizada com outro conteúdo ou usuário.");
        if (registro.get("resultado")!=null) return ler(registro.get("resultado").toString());

        // No Product entity has been loaded by the scalar preview. All locks use increasing ID order.
        var produtos=em.createQuery("select p from ProdutoEntity p where p.empresa.id=:empresa and p.id in :ids order by p.id",ProdutoEntity.class)
                .setParameter("empresa",u.empresaId()).setParameter("ids",ids(p))
                .setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList();
        var estados=estados(u.empresaId(),ids(p));
        var previa=avaliar(p,estados,null);
        if (previa.itens().stream().anyMatch(l->!l.erros().isEmpty()))
            throw conflito("Lote inválido. Nenhum ajuste aplicado. Atualize a prévia e corrija os produtos.");
        for (var item:p.itens()) {
            var atual=estados.get(item.produtoId());
            if (item.saldoEsperado().compareTo(atual.saldo())!=0
                    || !Objects.equals(item.ultimaMovimentacaoIdEsperada(),atual.ultimo()))
                throw conflito("Estoque alterado desde a prévia. Nenhum ajuste aplicado. Atualize a prévia.");
        }
        var entidades=new HashMap<Long,ProdutoEntity>(); produtos.forEach(x->entidades.put(x.getId(),x));
        var gerados=new HashMap<Long,Long>();
        for (var item:p.itens()) {
            if (estados.get(item.produtoId()).saldo().compareTo(item.valor())!=0) {
                var movimento=movimentos.ajustarLote(em.getReference(EmpresaEntity.class,u.empresaId()),
                        entidades.get(item.produtoId()),em.getReference(UsuarioEntity.class,u.usuarioId()),item.valor(),p.motivo().trim());
                gerados.put(item.produtoId(),movimento.getId());
            }
        }
        em.flush();
        var resultado=avaliar(p,estados,gerados);
        args.put("resultado",escrever(resultado));
        jdbc.update("update ajustes_estoque_lote set resultado=:resultado where empresa_id=:empresa and chave_requisicao=:chave",args);
        return resultado;
    }

    public void validarAcesso(UsuarioAutenticado u) { autorizar(u); }
    private void autorizar(UsuarioAutenticado u) {
        if(u==null || u.perfil()!=PerfilUsuario.ADMIN) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Somente ADMIN pode ajustar em massa.");
        var ativos=jdbc.queryForObject("""
            select count(*) from usuario u join empresas e on e.id=u.empresa_id
            where u.id=:usuario and u.empresa_id=:empresa and u.ativo=true and e.ativo=true and u.perfil='ADMIN'
            """,Map.of("usuario",u.usuarioId(),"empresa",u.empresaId()),Long.class);
        if(ativos==null || ativos!=1) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Administrador indisponível.");
    }
    private void validarPedido(Pedido p, boolean confirmacao) {
        if(p==null || !"SALDO_FINAL".equals(p.modo()) || p.motivo()==null || p.motivo().isBlank() || p.motivo().trim().length()>255
                || p.itens()==null || p.itens().isEmpty() || p.itens().size()>LIMITE)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Informe SALDO_FINAL, motivo de até 255 caracteres e de 1 a 200 produtos.");
        if (p.itens().stream().anyMatch(Objects::isNull)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Item inválido.");
        if(confirmacao && (p.chaveRequisicao()==null || p.itens().stream().anyMatch(i->i.saldoEsperado()==null)))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Chave de requisição e saldos da prévia são obrigatórios.");
    }
    private List<Long> ids(Pedido p) { return p.itens().stream().map(Item::produtoId).filter(Objects::nonNull).distinct().sorted().toList(); }
    private record Estado(String codigo,String nome,String unidade,BigDecimal saldo,boolean ativo,boolean controle,boolean composto,Long ultimo) { }
    private Map<Long,Estado> estados(Long empresa,List<Long> ids) {
        var resultado=new HashMap<Long,Estado>(); if(ids.isEmpty()) return resultado;
        jdbc.query("""
            select p.id,p.codigo_interno,p.nome,p.unidade_medida,p.estoque_atual,p.ativo,p.controla_estoque,p.composto,
              (select max(m.id) from movimentacoes_estoque m where m.empresa_id=p.empresa_id and m.produto_id=p.id) ultimo
            from produtos p where p.empresa_id=:empresa and p.id in (:ids)
            """,Map.of("empresa",empresa,"ids",ids),rs->{
                resultado.put(rs.getLong("id"),new Estado(rs.getString("codigo_interno"),rs.getString("nome"),rs.getString("unidade_medida"),
                    rs.getBigDecimal("estoque_atual"),rs.getBoolean("ativo"),rs.getBoolean("controla_estoque"),rs.getBoolean("composto"),(Long)rs.getObject("ultimo")));
            });
        return resultado;
    }
    private Resultado avaliar(Pedido p,Map<Long,Estado> estados,Map<Long,Long> movimentos) {
        var linhas=new ArrayList<Linha>(); var ocorrencias=new HashMap<Long,Integer>();
        p.itens().forEach(i->ocorrencias.merge(i.produtoId()==null?-1L:i.produtoId(),1,Integer::sum));
        for(var i:p.itens()) {
            var e=estados.get(i.produtoId()); var erros=new ArrayList<String>();
            if(e==null) erros.add("Produto não encontrado para esta empresa.");
            else {
                if(!e.ativo()) erros.add("Produto inativo. Reative o cadastro.");
                if(!e.controle() || e.composto()) erros.add("Produto sem controle individual ou Kit/Combo não recebe ajuste físico.");
            }
            if(ocorrencias.get(i.produtoId()==null?-1L:i.produtoId())>1) erros.add("Produto duplicado no lote.");
            if(!quantidadeValida(i.valor())) erros.add("Saldo deve ser não negativo, até 16 inteiros e 3 casas decimais.");
            BigDecimal diferenca=e!=null && quantidadeValida(i.valor())?i.valor().subtract(e.saldo()):null;
            String status=!erros.isEmpty()?"INVALIDO":diferenca.signum()==0?"SEM_ALTERACAO":movimentos==null?"VALIDO":"APLICADO";
            linhas.add(new Linha(i.produtoId(),e==null?null:e.codigo(),e==null?null:e.nome(),e==null?null:e.unidade(),e==null?null:e.saldo(),i.valor(),diferenca,
                    e==null?null:e.ultimo(),status,List.copyOf(erros),movimentos==null?null:movimentos.get(i.produtoId())));
        }
        return new Resultado(p.chaveRequisicao(),List.copyOf(linhas),(int)linhas.stream().filter(l->l.movimentacaoId()!=null).count(),(int)linhas.stream().filter(l->l.status().equals("SEM_ALTERACAO")).count());
    }
    private boolean quantidadeValida(BigDecimal q) { return q!=null && q.signum()>=0 && q.stripTrailingZeros().scale()<=3 && q.compareTo(new BigDecimal("9999999999999999.999"))<=0; }
    private String hash(Pedido p) {
        try {
            var valores=p.itens().stream().map(i->Arrays.asList(i.produtoId(),canonico(i.valor()),canonico(i.saldoEsperado()),i.ultimaMovimentacaoIdEsperada())).toList();
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsString(List.of(p.modo(),p.motivo().trim(),valores)).getBytes(StandardCharsets.UTF_8)));
        } catch(Exception e) { throw new IllegalStateException("Não foi possível identificar o lote.",e); }
    }
    private String canonico(BigDecimal q) { return q==null?null:q.stripTrailingZeros().toString(); }
    private Resultado ler(String s) { try {return json.readValue(s,Resultado.class);}catch(Exception e){throw new IllegalStateException("Resultado indisponível.",e);} }
    private String escrever(Resultado r) { try {return json.writeValueAsString(r);}catch(Exception e){throw new IllegalStateException("Resultado indisponível.",e);} }
    private ResponseStatusException conflito(String mensagem) { return new ResponseStatusException(HttpStatus.CONFLICT,mensagem); }
}
