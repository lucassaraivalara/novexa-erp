package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import jakarta.persistence.EntityManager;
import jakarta.validation.Validator;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.stream.Collectors;

/** Coordena uma baixa; saldos e estornos continuam no núcleo financeiro existente. */
@Service
public class PagamentoContaPagarService {
    private final ContaPagarRepository titulos;
    private final PagamentoContaPagarRepository pagamentos;
    private final ContaFinanceiraRepository contas;
    private final MovimentacaoFinanceiraRepository movimentos;
    private final UsuarioRepository usuarios;
    private final ContaFinanceiraService financeiro;
    private final EntityManager em;
    private final Validator validator;
    private final TransactionTemplate transacao;

    public PagamentoContaPagarService(ContaPagarRepository titulos, PagamentoContaPagarRepository pagamentos,
            ContaFinanceiraRepository contas, MovimentacaoFinanceiraRepository movimentos, UsuarioRepository usuarios,
            ContaFinanceiraService financeiro, EntityManager em, Validator validator, PlatformTransactionManager manager) {
        this.titulos=titulos; this.pagamentos=pagamentos; this.contas=contas; this.movimentos=movimentos;
        this.usuarios=usuarios; this.financeiro=financeiro; this.em=em; this.validator=validator;
        this.transacao=new TransactionTemplate(manager);
    }

    public PagamentoContaPagarResponseDTO pagar(Long tituloId,Long empresaId,Long usuarioId,PagamentoMultiorigemContaPagarDTO p) {
        if (p==null || !validator.validate(p).isEmpty()) throw erro(HttpStatus.BAD_REQUEST,"Informe data, chave e de uma a dez origens com valores positivos em centavos.");
        var origens=p.origens().stream().sorted(Comparator.comparing(PagamentoMultiorigemContaPagarDTO.Origem::contaFinanceiraId)).toList();
        if (origens.stream().map(PagamentoMultiorigemContaPagarDTO.Origem::contaFinanceiraId).distinct().count()!=origens.size())
            throw erro(HttpStatus.BAD_REQUEST,"Utilize cada conta financeira apenas uma vez no pagamento.");
        BigDecimal juros=dinheiro(p.juros()), multa=dinheiro(p.multa()), desconto=dinheiro(p.desconto());
        var soma=origens.stream().map(o->o.valor()).reduce(BigDecimal.ZERO,BigDecimal::add);
        if (soma.compareTo(p.valorPago())!=0) throw erro(HttpStatus.BAD_REQUEST,"A soma das origens deve corresponder exatamente ao total a pagar.");
        String assinatura=assinatura(tituloId,usuarioId,p,origens,juros,multa,desconto);
        try {
            return transacao.execute(s -> {
                var titulo=bloquearTitulo(tituloId,empresaId);
                var existente=pagamentos.findByEmpresaIdAndChaveRequisicao(empresaId,p.chaveRequisicao());
                if(existente.isPresent())return replay(existente.get(),assinatura);
                if(titulo.getStatus()!=StatusContaPagar.ABERTA)throw erro(HttpStatus.CONFLICT,"Somente contas abertas podem ser pagas. Atualize a consulta.");
                var total=titulo.getValor().add(juros).add(multa).subtract(desconto);
                if(total.signum()<=0 || total.compareTo(p.valorPago())!=0)
                    throw erro(HttpStatus.BAD_REQUEST,"O pagamento deve quitar o valor original + juros + multa − desconto. Pagamentos parciais não são permitidos.");
                var bloqueadas=bloquearContas(empresaId,origens.stream().map(o->o.contaFinanceiraId()).toList());
                for(var o:origens) {
                    var c=bloqueadas.get(o.contaFinanceiraId());
                    if(!c.isAtivo())throw erro(HttpStatus.CONFLICT,"Conta financeira "+c.getNome()+" está inativa.");
                    if(c.getTipo()==TipoContaFinanceira.ADQUIRENTE)
                        throw erro(HttpStatus.CONFLICT,"Conta do tipo Adquirente não é origem de dinheiro disponível. Selecione uma conta financeira elegível.");
                    if(c.getSaldoAtual().compareTo(o.valor())<0)throw erro(HttpStatus.CONFLICT,"Saldo insuficiente na conta financeira "+c.getNome()+".");
                }
                var usuario=usuario(usuarioId,empresaId);
                var pagamento=pagamentos.saveAndFlush(new PagamentoContaPagarEntity(titulo,usuario,p.chaveRequisicao(),assinatura,
                    p.dataPagamento(),juros,multa,desconto,total));
                for(var o:origens)financeiro.registrarSaidaAgrupada(bloqueadas.get(o.contaFinanceiraId()),pagamento,o.valor(),usuario);
                titulo.pagarAgrupado(pagamento); titulos.saveAndFlush(titulo);
                return resposta(pagamento);
            });
        } catch(DataIntegrityViolationException e) {
            // Só depois do rollback integral: uma chave pode ter vencido em outro título.
            return transacao.execute(s->pagamentos.findByEmpresaIdAndChaveRequisicao(empresaId,p.chaveRequisicao())
                .map(existente->replay(existente,assinatura)).orElseThrow(()->e));
        }
    }

    @Transactional(readOnly=true, isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public PagamentoContaPagarResponseDTO buscarPorChave(Long tituloId,Long empresaId,UUID chave) {
        var pagamento=pagamentos.findByEmpresaIdAndChaveRequisicao(empresaId,chave)
            .filter(p->p.getContaPagar().getId().equals(tituloId))
            .orElseThrow(()->erro(HttpStatus.NOT_FOUND,"Pagamento ainda não localizado nesta obrigação."));
        return resposta(pagamento);
    }

    @Transactional(readOnly=true, isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public PaginaResponseDTO<PagamentoContaPagarResponseDTO> historico(Long tituloId,Long empresaId,int page,int size) {
        if(!titulos.existsByIdAndEmpresaId(tituloId,empresaId))throw erro(HttpStatus.NOT_FOUND,"Conta a pagar não encontrada.");
        var pagina=pagamentos.findByContaPagarIdAndEmpresaId(tituloId,empresaId,
            br.com.novexa.erp.util.Paginacao.criar(page,size,"dataPagamento,desc",Set.of("dataPagamento","id"),Sort.Direction.DESC));
        var ids=pagina.getContent().stream().map(PagamentoContaPagarEntity::getId).toList();
        var porPagamento=ids.isEmpty()?Map.<Long,List<OrigemPagamentoContaPagarDTO>>of():movimentos.origensPagamentosContaPagar(empresaId,ids)
            .stream().collect(Collectors.groupingBy(OrigemPagamentoContaPagarDTO::pagamentoId));
        return PaginaResponseDTO.de(pagina,p->PagamentoContaPagarResponseDTO.de(p,porPagamento.getOrDefault(p.getId(),List.of())));
    }

    @Transactional
    public PagamentoContaPagarResponseDTO estornar(Long tituloId,Long pagamentoId,Long empresaId,Long usuarioId,
            MovimentacaoFinanceiraEstornoDTO pedido) {
        if(pedido==null || !validator.validate(pedido).isEmpty())throw erro(HttpStatus.BAD_REQUEST,"Informe o motivo do estorno, com até 500 caracteres.");
        var titulo=bloquearTitulo(tituloId,empresaId);
        var p=pagamentos.findByIdAndContaPagarIdAndEmpresaId(pagamentoId,tituloId,empresaId)
            .orElseThrow(()->erro(HttpStatus.NOT_FOUND,"Pagamento não encontrado nesta conta a pagar."));
        String motivo=pedido.motivoEstorno().trim();
        if(p.getEstado().equals("ESTORNADO")) {
            if(!p.getMotivoEstorno().equals(motivo))throw erro(HttpStatus.CONFLICT,"Pagamento já estornado com outro motivo.");
            return resposta(p);
        }
        if(titulo.getStatus()!=StatusContaPagar.PAGA || titulo.getPagamentoAtual()==null || !titulo.getPagamentoAtual().getId().equals(p.getId()))
            throw erro(HttpStatus.CONFLICT,"O pagamento não corresponde à baixa atual. Atualize a consulta.");
        var origens=movimentos.origensPagamentosContaPagar(empresaId,List.of(p.getId()));
        if(origens.isEmpty() || origens.stream().anyMatch(OrigemPagamentoContaPagarDTO::estornada)
                || origens.stream().map(OrigemPagamentoContaPagarDTO::valor).reduce(BigDecimal.ZERO,BigDecimal::add).compareTo(p.getTotalPago())!=0)
            throw erro(HttpStatus.CONFLICT,"Histórico das origens está inconsistente. Nenhuma origem foi estornada.");
        var bloqueadas=bloquearContas(empresaId,origens.stream().map(OrigemPagamentoContaPagarDTO::contaFinanceiraId).sorted().toList());
        var efeitos=movimentos.bloquearOrigensPagamento(empresaId,p.getId());
        var usuario=usuario(usuarioId,empresaId);
        for(var m:efeitos)financeiro.estornarSaidaAgrupada(bloqueadas.get(m.getContaFinanceira().getId()),m,usuario,motivo);
        p.estornar(usuario,motivo); pagamentos.saveAndFlush(p);
        titulo.abrir();titulos.saveAndFlush(titulo);
        return resposta(p);
    }

    @Transactional
    public boolean estornarAtual(ContaPagarEntity titulo,Long empresaId,Long usuarioId) {
        if(titulo.getPagamentoAtual()==null || !titulo.getPagamentoAtual().getEstado().equals("CONFIRMADO"))return false;
        estornar(titulo.getId(),titulo.getPagamentoAtual().getId(),empresaId,usuarioId,
            new MovimentacaoFinanceiraEstornoDTO("Estorno da baixa da conta a pagar #"+titulo.getId()));
        return true;
    }
    private ContaPagarEntity bloquearTitulo(Long id,Long empresa) {
        var t=titulos.buscarParaAlterar(id,empresa).orElseThrow(()->erro(HttpStatus.NOT_FOUND,"Conta a pagar não encontrada."));
        em.refresh(t);return t;
    }
    private Map<Long,ContaFinanceiraEntity> bloquearContas(Long empresa,List<Long> ids) {
        var lista=contas.bloquearOrdenadas(empresa,ids);
        if(lista.size()!=ids.size())throw erro(HttpStatus.NOT_FOUND,"Uma das contas financeiras não foi encontrada na empresa.");
        var mapa=new LinkedHashMap<Long,ContaFinanceiraEntity>();
        for(var c:lista){em.refresh(c);mapa.put(c.getId(),c);}return mapa;
    }
    private UsuarioEntity usuario(Long id,Long empresa) {
        return usuarios.findByIdAndEmpresaId(id,empresa).orElseThrow(()->erro(HttpStatus.NOT_FOUND,"Usuário não encontrado."));
    }
    private PagamentoContaPagarResponseDTO replay(PagamentoContaPagarEntity p,String assinatura) {
        if(!p.getResumoRequisicao().equals(assinatura))throw erro(HttpStatus.CONFLICT,"Chave de pagamento já utilizada com dados diferentes.");
        return resposta(p);
    }
    private PagamentoContaPagarResponseDTO resposta(PagamentoContaPagarEntity p) {
        return PagamentoContaPagarResponseDTO.de(p,movimentos.origensPagamentosContaPagar(p.getEmpresa().getId(),List.of(p.getId())));
    }
    private BigDecimal dinheiro(BigDecimal v){return v==null?new BigDecimal("0.00"):v.setScale(2);}
    private String assinatura(Long id,Long usuario,PagamentoMultiorigemContaPagarDTO p,List<PagamentoMultiorigemContaPagarDTO.Origem> origens,
            BigDecimal juros,BigDecimal multa,BigDecimal desconto) {
        var s=new StringBuilder().append(id).append('|').append(usuario).append('|').append(p.dataPagamento())
            .append('|').append(dinheiro(p.valorPago())).append('|').append(juros).append('|').append(multa).append('|').append(desconto);
        origens.forEach(o->s.append('|').append(o.contaFinanceiraId()).append(':').append(dinheiro(o.valor())));
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.toString().getBytes(StandardCharsets.UTF_8)));}
        catch(java.security.NoSuchAlgorithmException e){throw new IllegalStateException(e);}
    }
    private ResponseStatusException erro(HttpStatus status,String mensagem){return new ResponseStatusException(status,mensagem);}
}
