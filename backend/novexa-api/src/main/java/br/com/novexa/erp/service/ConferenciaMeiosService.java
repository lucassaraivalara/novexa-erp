package br.com.novexa.erp.service;
import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.util.*;
@Service
public class ConferenciaMeiosService {
    private final EmpresaRepository empresas;
    private final CaixaOperacionalService operacional;
    private final ConferenciaFechamentoCaixaRepository conferencias;
    private final EntityManager em;
    public ConferenciaMeiosService(EmpresaRepository empresas,CaixaOperacionalService operacional,
            ConferenciaFechamentoCaixaRepository conferencias,EntityManager em) {
        this.empresas=empresas; this.operacional=operacional; this.conferencias=conferencias; this.em=em;
    }
    public record Resultado(ModalidadeConferencia modalidade,String observacao,List<ConferenciaFechamentoCaixaEntity> linhas) { }
    @Transactional(propagation=Propagation.MANDATORY)
    public Resultado preparar(SessaoCaixaEntity sessao,FechamentoCaixaDTO pedido) {
        var c=pedido.conferenciaMeios();
        if (pedido.conferencia()!=null || c.modo()==null || c.meios()==null)
            throw erro(HttpStatus.BAD_REQUEST,"Informe somente a conferência de meios de pagamento.");
        String observacao=c.observacao()==null?null:c.observacao().strip();
        if (observacao!=null && observacao.isBlank()) observacao=null;
        var modalidade=c.modo()==ModoConferenciaFechamento.TOTAL?ModalidadeConferencia.TOTAL_MEIOS:ModalidadeConferencia.POR_CONFIGURACAO;
        if (sessao.getStatus()!=StatusSessaoCaixa.ABERTO) {
            var salvas=conferencias.findBySessaoIdAndEmpresaIdOrderByIdAsc(sessao.getId(),sessao.getEmpresa().getId());
            if (sessao.getModalidadeConferencia()!=modalidade || !Objects.equals(sessao.getObservacaoFechamento(),observacao)
                    || sessao.getSaldoFinal().compareTo(pedido.saldoFinal())!=0 || !mesmosValores(salvas,c))
                throw erro(HttpStatus.CONFLICT,"Sessão de Caixa já fechada com outros dados.");
            return new Resultado(modalidade,observacao,salvas);
        }
        var empresa=empresas.politicaComLock(sessao.getEmpresa().getId()).orElseThrow(); em.refresh(empresa);
        if (empresa.getModoConferenciaFechamento()!=c.modo())
            throw erro(HttpStatus.CONFLICT,"A configuração de fechamento mudou. Atualize a conferência.");
        var resumo=operacional.calcular(sessao);
        var linhas=new ArrayList<ConferenciaFechamentoCaixaEntity>();
        linhas.add(new ConferenciaFechamentoCaixaEntity(sessao,null,"Dinheiro físico",TipoFormaPagamento.DINHEIRO,
                resumo.saldoEsperadoDinheiro(),pedido.saldoFinal()));
        var esperadas=resumo.totaisPorConfiguracao().stream().filter(f -> !f.tipo().equals("DINHEIRO")).toList();
        boolean exigir=empresa.isExigirValoresInformadosNoFechamento();
        if (c.modo()==ModoConferenciaFechamento.TOTAL) {
            if (!c.meios().isEmpty()) throw erro(HttpStatus.BAD_REQUEST,"O modo Total não recebe valores por configuração.");
            validarValor(c.totalInformado(),exigir);
            linhas.add(ConferenciaFechamentoCaixaEntity.total(sessao,esperadas.stream().map(ResumoSessaoCaixaDTO.TotalConfiguracao::total)
                    .reduce(BigDecimal.ZERO,BigDecimal::add),c.totalInformado()));
        } else {
            if (c.totalInformado()!=null) throw erro(HttpStatus.BAD_REQUEST,"Informe os valores por configuração, sem total concorrente.");
            var informados=mapear(c.meios());
            var chaves=new HashSet<String>();
            for (var f:esperadas) {
                String chave=chave(f.configuracaoId(),f.configuracaoId()==null?f.formaPagamentoId():null);
                chaves.add(chave);
                if (!informados.containsKey(chave)) throw erro(HttpStatus.BAD_REQUEST,"Informe exatamente os meios não dinheiro da sessão.");
                var informado=informados.get(chave); validarValor(informado,exigir);
                linhas.add(ConferenciaFechamentoCaixaEntity.configuracao(sessao,
                        f.configuracaoId()==null?null:em.getReference(ConfiguracaoFormaPagamentoEmpresaEntity.class,f.configuracaoId()),
                        f.configuracaoId()==null?em.getReference(FormaPagamentoEntity.class,f.formaPagamentoId()):null,
                        f.descricao(),TipoFormaPagamento.valueOf(f.tipo()),f.total(),informado));
            }
            if (!chaves.equals(informados.keySet())) throw erro(HttpStatus.BAD_REQUEST,"Há meios extras ou ausentes na conferência.");
        }
        if (observacao==null && linhas.stream().anyMatch(l -> l.getDiferenca()!=null && l.getDiferenca().signum()!=0))
            throw erro(HttpStatus.CONFLICT,"Informe uma observação para fechar com divergência.");
        return new Resultado(modalidade,observacao,linhas);
    }
    private boolean mesmosValores(List<ConferenciaFechamentoCaixaEntity> salvas,FechamentoCaixaDTO.ConferenciaMeios c) {
        if (c.modo()==ModoConferenciaFechamento.TOTAL) {
            var totais=salvas.stream().filter(l -> l.getEscopo()==EscopoConferenciaCaixa.TOTAL_MEIOS).toList();
            return c.meios().isEmpty() && totais.size()==1 && iguais(totais.getFirst().getValorInformado(),c.totalInformado());
        }
        if (c.totalInformado()!=null) return false;
        var mapa=mapear(c.meios());
        var meios=salvas.stream().filter(l -> l.getEscopo()!=EscopoConferenciaCaixa.DINHEIRO_FISICO).toList();
        return mapa.size()==meios.size() && meios.stream().allMatch(l -> {
            String key=chave(l.getConfiguracaoId(),l.getForma()==null?null:l.getForma().getId());
            return mapa.containsKey(key) && iguais(mapa.get(key),l.getValorInformado());
        });
    }
    private Map<String,BigDecimal> mapear(List<FechamentoCaixaDTO.Meio> meios) {
        var mapa=new HashMap<String,BigDecimal>();
        for (var m:meios) {
            var key=chave(m.configuracaoId(),m.formaPagamentoId()); validarValor(m.valorInformado(),false);
            if (mapa.containsKey(key)) throw erro(HttpStatus.BAD_REQUEST,"Meio duplicado na conferência."); mapa.put(key,m.valorInformado());
        }
        return mapa;
    }
    private String chave(Long configuracao,Long forma) {
        if ((configuracao==null)==(forma==null) || (configuracao!=null && configuracao<=0) || (forma!=null && forma<=0))
            throw erro(HttpStatus.BAD_REQUEST,"Informe uma configuração ou uma forma legada válida.");
        return configuracao!=null?"c:"+configuracao:"f:"+forma;
    }
    private boolean iguais(BigDecimal a,BigDecimal b) { return a==null?b==null:b!=null && a.compareTo(b)==0; }
    private void validarValor(BigDecimal valor,boolean exigir) {
        if (valor==null) { if (exigir) throw erro(HttpStatus.BAD_REQUEST,"Informe todos os valores conferidos."); return; }
        if (valor.signum()<0 || valor.scale()>2 || valor.precision()-valor.scale()>17)
            throw erro(HttpStatus.BAD_REQUEST,"Informe valor não negativo com até duas casas decimais.");
    }
    private ResponseStatusException erro(HttpStatus status,String msg) { return new ResponseStatusException(status,msg); }
}
