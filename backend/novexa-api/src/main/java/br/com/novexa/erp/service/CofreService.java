package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.jdbc.core.JdbcTemplate;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service @Transactional
public class CofreService {
    private final RecolhimentoCofreRepository registros;
    private final SessaoCaixaRepository sessoes;
    private final CaixaRepository caixas;
    private final UsuarioRepository usuarios;
    private final ContaFinanceiraRepository contas;
    private final MovimentacaoCaixaRepository movimentosCaixa;
    private final MovimentacaoFinanceiraRepository movimentos;
    private final CaixaOperacionalService operacional;
    private final EntityManager em;
    private final JdbcTemplate jdbc;
    public CofreService(RecolhimentoCofreRepository registros,SessaoCaixaRepository sessoes,CaixaRepository caixas,
            UsuarioRepository usuarios,ContaFinanceiraRepository contas,MovimentacaoCaixaRepository movimentosCaixa,
            MovimentacaoFinanceiraRepository movimentos,CaixaOperacionalService operacional,EntityManager em,JdbcTemplate jdbc) {
        this.registros=registros;this.sessoes=sessoes;this.caixas=caixas;this.usuarios=usuarios;this.contas=contas;
        this.movimentosCaixa=movimentosCaixa;this.movimentos=movimentos;this.operacional=operacional;this.em=em;this.jdbc=jdbc;
    }
    public record Registro(Long id,Long sessaoId,String tipo,BigDecimal valor,BigDecimal valorTroco,String responsavel,
            String observacao,Long contaCofreId,String contaCofreNome,String operador,LocalDateTime dataCriacao,
            LocalDateTime dataConfirmacao,Long movimentoFinanceiroId) { }
    private Registro dto(RecolhimentoCofreEntity r) {
        return new Registro(r.id,r.sessao.getId(),r.tipo,r.valor,r.valorTroco,r.responsavel,r.observacao,
                r.conta==null?null:r.conta.getId(),r.conta==null?null:r.conta.getNome(),r.usuario.getNomeUsuario(),
                r.dataCriacao,r.dataConfirmacao,r.movimentoFinanceiro==null?null:r.movimentoFinanceiro.getId());
    }
    private boolean gerente(UsuarioAutenticado a) { return a.perfil()==PerfilUsuario.ADMIN||a.perfil()==PerfilUsuario.GERENTE; }
    private UsuarioEntity usuario(UsuarioAutenticado a) {
        var u=usuarios.buscarComLock(a.usuarioId(),a.empresaId()).orElseThrow(()->erro("Operador indisponível."));
        if(!Boolean.TRUE.equals(u.getAtivo())||!Boolean.TRUE.equals(u.getEmpresa().getAtivo())) throw erro("Operador indisponível.");
        return u;
    }
    private SessaoCaixaEntity sessao(Long id,UsuarioAutenticado a) {
        var referencia=sessoes.findByIdAndEmpresaId(id,a.empresaId()).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Sessão não encontrada."));
        caixas.buscarComLock(referencia.getCaixa().getId(),a.empresaId()).orElseThrow(()->erro("Caixa indisponível."));
        var s=operacional.bloquear(id,a.empresaId());
        if(!gerente(a)&&!s.getUsuarioAbertura().getId().equals(a.usuarioId()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Acesso permitido somente à própria sessão.");
        return s;
    }
    private ContaFinanceiraEntity conta(Long id,Long empresa) {
        if(id==null) throw erro("Selecione uma conta COFRE.");
        var c=contas.buscarParaAlterar(id,empresa).orElseThrow(()->erro("Conta COFRE não encontrada."));
        em.refresh(c);
        if(c.getTipo()!=TipoContaFinanceira.COFRE||!c.isAtivo()) throw erro("Selecione uma conta COFRE ativa da empresa.");
        return c;
    }
    private String texto(String s) { return s==null||s.isBlank()?null:s.strip(); }
    private void validar(EntregaCofreDTO p) {
        if(p==null||p.valor()==null||p.valorTroco()==null||p.valor().signum()<0||p.valorTroco().signum()<0
                ||p.valor().scale()>2||p.valorTroco().scale()>2||p.valor().precision()-p.valor().scale()>12
                ||p.valorTroco().precision()-p.valorTroco().scale()>12) throw erro("Informe valores não negativos com até duas casas decimais.");
        if(p.valor().signum()>0&&(p.contaCofreId()==null||texto(p.responsavel())==null)) throw erro("Informe cofre e responsável pelo recebimento.");
        if(p.responsavel()!=null&&p.responsavel().length()>150||p.observacao()!=null&&p.observacao().length()>500)
            throw erro("Responsável ou observação excede o tamanho permitido.");
    }
    private RecolhimentoCofreEntity novo(SessaoCaixaEntity s,UsuarioEntity u,String tipo,UUID chave,EntregaCofreDTO p) {
        var r=new RecolhimentoCofreEntity();r.empresa=s.getEmpresa();r.sessao=s;r.usuario=u;r.tipo=tipo;r.chaveRequisicao=chave;
        r.valor=p.valor();r.valorTroco=p.valorTroco();r.responsavel=texto(p.responsavel());r.observacao=texto(p.observacao());
        r.dataCriacao=LocalDateTime.now();
        if(r.valor.signum()>0) r.conta=conta(p.contaCofreId(),s.getEmpresa().getId());
        return r;
    }
    private void mesmos(RecolhimentoCofreEntity r,EntregaCofreDTO p) {
        if(r.valor.compareTo(p.valor())!=0||r.valorTroco.compareTo(p.valorTroco())!=0
                ||r.valor.signum()>0&&!Objects.equals(r.conta==null?null:r.conta.getId(),p.contaCofreId())
                ||!Objects.equals(r.responsavel,texto(p.responsavel()))||!Objects.equals(r.observacao,texto(p.observacao())))
            throw erro("Esta destinação já foi registrada com outros dados. Consulte o histórico.");
    }
    // Chamado sob os locks existentes do fechamento, na mesma transação.
    public void fechamento(SessaoCaixaEntity s,UsuarioEntity u,EntregaCofreDTO p) {
        if(p==null) return;
        validar(p);
        if(p.valor().add(p.valorTroco()).compareTo(s.getSaldoFinal())!=0)
            throw erro("Valor enviado ao cofre mais troco mantido deve corresponder ao dinheiro contado.");
        var existente=registros.findBySessaoIdAndTipo(s.getId(),"FECHAMENTO");
        var r=existente.orElseGet(()->novo(s,u,"FECHAMENTO",UUID.nameUUIDFromBytes(("cofre-fechamento:"+s.getId()).getBytes(java.nio.charset.StandardCharsets.UTF_8)),p));
        if(existente.isPresent()) mesmos(r,p);
        registros.saveAndFlush(r);
        if(p.confirmarEntrega()&&r.valor.signum()>0) confirmarInterno(r,u);
    }
    public Registro destinar(Long id,EntregaCofreDTO p,UsuarioAutenticado a) {
        var u=usuario(a);var s=sessao(id,a);
        if(s.getStatus()!=StatusSessaoCaixa.FECHADO) throw erro("Confirme primeiro o fechamento da sessão.");
        fechamento(s,u,p);return dto(registros.findBySessaoIdAndTipo(id,"FECHAMENTO").orElseThrow());
    }
    public Registro confirmar(Long id,boolean confirmado,UsuarioAutenticado a) {
        if(!confirmado) throw erro("Confirme explicitamente a entrega do dinheiro.");
        var u=usuario(a);var referencia=registros.findByIdAndEmpresaId(id,a.empresaId()).orElseThrow(()->erro("Recolhimento não encontrado."));
        sessao(referencia.sessao.getId(),a);
        em.refresh(referencia);
        if(!referencia.tipo.equals("FECHAMENTO")&&!gerente(a)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Ação gerencial.");
        if(referencia.valor.signum()<=0) throw erro("Não há valor para recolher; o dinheiro foi mantido para troco.");
        confirmarInterno(referencia,u);return dto(referencia);
    }
    private void confirmarInterno(RecolhimentoCofreEntity r,UsuarioEntity u) {
        if(r.dataConfirmacao!=null) return;
        var c=conta(r.conta.getId(),r.empresa.getId());
        var tipo=r.tipo.equals("DEVOLUCAO_TROCO")?TipoMovimentacaoFinanceira.SAIDA:TipoMovimentacaoFinanceira.ENTRADA;
        if(tipo==TipoMovimentacaoFinanceira.SAIDA&&c.getSaldoAtual().compareTo(r.valor)<0) throw erro("Saldo insuficiente no cofre.");
        c.aplicar(tipo==TipoMovimentacaoFinanceira.ENTRADA?r.valor:r.valor.negate());
        r.movimentoFinanceiro=movimentos.saveAndFlush(new MovimentacaoFinanceiraEntity(c,tipo,OrigemMovimentacaoFinanceira.MOVIMENTO_COFRE,
                (tipo==TipoMovimentacaoFinanceira.ENTRADA?"Recolhimento":"Devolução para troco")+" · sessão #"+r.sessao.getId(),
                r.valor,LocalDate.now(),r.observacao,u));
        r.usuarioConfirmacao=u;r.dataConfirmacao=LocalDateTime.now();registros.saveAndFlush(r);
    }
    public MovimentacaoCaixaResponseDTO sangria(Long id,MovimentacaoCaixaRequestDTO p,UsuarioAutenticado a) {
        if(!gerente(a)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Ação gerencial.");
        validar(p.cofre());
        if(p.tipo()!=TipoMovimentacaoCaixa.SANGRIA||p.cofre().valor().compareTo(p.valor())!=0||p.cofre().valorTroco().signum()!=0)
            throw erro("O envio ao cofre deve corresponder à sangria, sem troco.");
        var u=usuario(a);var s=sessao(id,a);
        var movimento=operacional.movimentar(id,p,a);
        var existente=registros.findByMovimentoCaixaId(movimento.id());
        var r=existente.orElseGet(()->novo(s,u,"SANGRIA",p.chaveRequisicao(),p.cofre()));
        if(existente.isPresent()) mesmos(r,p.cofre());
        r.movimentoCaixa=movimentosCaixa.findById(movimento.id()).orElseThrow();registros.saveAndFlush(r);
        if(p.cofre().confirmarEntrega()) confirmarInterno(r,u);
        return movimento;
    }
    public record Devolucao(@jakarta.validation.constraints.NotNull UUID chaveRequisicao,
            @jakarta.validation.constraints.NotNull Long sessaoId,@jakarta.validation.Valid @jakarta.validation.constraints.NotNull EntregaCofreDTO entrega) { }
    public Registro devolver(Devolucao p,UsuarioAutenticado a) {
        if(!gerente(a)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Ação gerencial.");
        validar(p.entrega());
        if(!p.entrega().confirmarEntrega()||p.entrega().valor().signum()<=0||p.entrega().valorTroco().signum()!=0)
            throw erro("Confirme a devolução de valor positivo, sem troco retido.");
        var u=usuario(a);var s=sessao(p.sessaoId(),a);
        var existente=registros.findByEmpresaIdAndChaveRequisicao(a.empresaId(),p.chaveRequisicao());
        if(existente.isPresent()) {
            var r=existente.get();mesmos(r,p.entrega());
            if(!r.tipo.equals("DEVOLUCAO_TROCO")||!r.sessao.getId().equals(s.getId())) throw erro("Chave já utilizada.");
            return dto(r);
        }
        if(s.getStatus()!=StatusSessaoCaixa.ABERTO) throw erro("A devolução para troco exige sessão aberta.");
        var r=novo(s,u,"DEVOLUCAO_TROCO",p.chaveRequisicao(),p.entrega());
        var movimento=operacional.movimentar(s.getId(),new MovimentacaoCaixaRequestDTO(p.chaveRequisicao(),TipoMovimentacaoCaixa.SUPRIMENTO,
                p.entrega().valor(),"Devolução do cofre #"+r.conta.getId()),a);
        r.movimentoCaixa=movimentosCaixa.findById(movimento.id()).orElseThrow();registros.saveAndFlush(r);
        confirmarInterno(r,u);return dto(r);
    }
    @Transactional(readOnly=true)
    public Map<String,Object> resumo(UsuarioAutenticado a) {
        var lista=jdbc.queryForList("select id,nome,saldo_atual as \"saldoAtual\",ativo from contas_financeiras where empresa_id=? and tipo='COFRE' order by nome,id",a.empresaId());
        var saldos=jdbc.queryForMap("""
            select coalesce(sum(case when m.tipo='ENTRADA' then m.valor else 0 end),0) as entradas,
                   coalesce(sum(case when m.tipo='SAIDA' then m.valor else 0 end),0) as saidas
            from movimentacoes_financeiras m join contas_financeiras c on c.id=m.conta_financeira_id and c.empresa_id=m.empresa_id
            where m.empresa_id=? and c.tipo='COFRE' and not m.estornada
            """,a.empresaId());
        BigDecimal saldo=lista.stream().map(c->(BigDecimal)c.get("saldoAtual")).reduce(BigDecimal.ZERO,BigDecimal::add);
        return Map.of("saldo",saldo,"entradas",saldos.get("entradas"),"saidas",saldos.get("saidas"),"contas",lista);
    }
    private Map<String,Object> pagina(String from,String fields,String order,UsuarioAutenticado a,int page) {
        if(page<0||page>100000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Página inválida.");
        Object[] filtros={a.empresaId(),gerente(a),a.usuarioId()};
        Long total=jdbc.queryForObject("select count(*) "+from,Long.class,filtros);
        var args=new ArrayList<>(Arrays.asList(filtros));args.add(20);args.add(page*20);
        var items=jdbc.queryForList("select "+fields+" "+from+" order by "+order+" limit ? offset ?",args.toArray());
        return Map.of("items",items,"page",page,"size",20,"totalItems",total==null?0:total,"totalPages",total==null?0:(total+19)/20);
    }
    @Transactional(readOnly=true)
    public Map<String,Object> pendencias(UsuarioAutenticado a,int page) {
        return pagina("""
            from sessoes_caixa s join usuario u on u.id=s.usuario_abertura_id
            left join recolhimentos_cofre r on r.sessao_id=s.id and r.tipo='FECHAMENTO'
            where s.empresa_id=? and (? or s.usuario_abertura_id=?) and s.status='FECHADO'
             and s.saldo_final>0 and r.data_confirmacao is null and (r.id is null or r.valor>0)
            ""","s.id as \"sessaoId\",u.nome_usuario as operador,s.saldo_final as contado,coalesce(r.valor,s.saldo_final) as valor,coalesce(r.valor_troco,0) as \"valorTroco\",r.id as \"recolhimentoId\",r.responsavel,s.data_fechamento as data","s.data_fechamento desc,s.id desc",a,page);
    }
    @Transactional(readOnly=true)
    public Map<String,Object> historico(UsuarioAutenticado a,int page) {
        return pagina("""
            from recolhimentos_cofre r join sessoes_caixa s on s.id=r.sessao_id
             join usuario u on u.id=r.usuario_id left join contas_financeiras c on c.id=r.conta_id
            where r.empresa_id=? and (? or s.usuario_abertura_id=?)
            ""","r.id,r.sessao_id as \"sessaoId\",r.tipo,r.valor,r.valor_troco as \"valorTroco\",r.responsavel,r.observacao,u.nome_usuario as operador,c.nome as cofre,r.data_criacao as data,r.data_confirmacao as \"dataConfirmacao\",r.movimento_financeiro_id as \"movimentoFinanceiroId\"","r.id desc",a,page);
    }
    private ResponseStatusException erro(String mensagem) { return new ResponseStatusException(HttpStatus.CONFLICT,mensagem); }
}
