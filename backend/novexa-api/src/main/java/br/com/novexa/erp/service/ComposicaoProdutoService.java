package br.com.novexa.erp.service;

import br.com.novexa.erp.time.TempoNovexa;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.repository.*;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.math.*;
import java.time.LocalDateTime;
import java.util.*;

@Service @Transactional
public class ComposicaoProdutoService {
    private final ComponenteProdutoRepository composicoes;
    private final ConsumoKitVendaRepository consumos;
    private final ProdutoRepository produtos;
    private final UsuarioRepository usuarios;
    private final EntityManager em;
    public ComposicaoProdutoService(ComponenteProdutoRepository composicoes,ConsumoKitVendaRepository consumos,
            ProdutoRepository produtos,UsuarioRepository usuarios,EntityManager em) {
        this.composicoes=composicoes;this.consumos=consumos;this.produtos=produtos;this.usuarios=usuarios;this.em=em;
    }
    public record Linha(Long id,long versao,Long produtoId,String nome,String unidade,BigDecimal quantidade,BigDecimal fator,
            String unidadeEstoque,Long usuarioId,LocalDateTime data) { }
    @Transactional(readOnly=true)
    public List<Linha> historico(Long id,Long empresa) {
        produtos.findByIdAndEmpresaId(id,empresa).orElseThrow(()->erro("Produto não encontrado."));
        return composicoes.findByEmpresaIdAndProdutoIdOrderByVersaoDescIdAsc(empresa,id).stream().map(c->
            new Linha(c.id,c.versao,c.componente.getId(),c.nomeComponente,c.unidade,c.quantidade,c.fator,
                c.unidadeEstoque,c.usuario.getId(),c.dataCriacao)).toList();
    }
    public List<ComponenteProdutoEntity> atuais(Long empresa,Collection<Long> ids) {
        return ids.isEmpty()?List.of():composicoes.atuais(empresa,ids);
    }
    @Transactional(readOnly=true)
    public Map<Long,List<ProdutoResponseDTO.Componente>> consultas(Long empresa,Collection<Long> ids) {
        var resultado=new HashMap<Long,List<ProdutoResponseDTO.Componente>>();
        for(var c:atuais(empresa,ids))resultado.computeIfAbsent(c.produto.getId(),x->new ArrayList<>()).add(
                new ProdutoResponseDTO.Componente(c.componente.getId(),c.componente.getNome(),c.unidadeEstoque,c.consumoUnitario(),c.componente.getEstoqueAtual()));
        return resultado;
    }
    public void bloquearEdicao(Long id,Long empresa,List<ComponenteProdutoDTO> linhas) {
        var ids=new TreeSet<Long>();if(id!=null)ids.add(id);
        linhas.forEach(l->{if(l!=null&&l.produtoId()!=null)ids.add(l.produtoId());});
        for(var pid:ids) { var p=produtos.findByIdAndEmpresaIdWithLock(pid,empresa).orElseThrow(()->erro("Componente indisponível para esta empresa."));em.refresh(p); }
    }
    public void gravar(ProdutoEntity p,ProdutoRequestDTO dados) {
        boolean composto=p.isComposto()||Boolean.TRUE.equals(dados.getComposto());
        if(!composto) {
            if(dados.getComponentes()!=null&&!dados.getComponentes().isEmpty()) throw erro("Produto simples não possui composição.");
            return;
        }
        p.setControlaEstoque(true);
        if(dados.getComponentes()==null) {
            if(p.getComposicaoVersao()==0)throw erro("Informe a composição do Kit/Combo.");
            return;
        }
        if(dados.getComponentes().isEmpty()||dados.getComponentes().size()>100)throw erro("Informe de 1 a 100 componentes físicos.");
        var u=usuarios.findByIdAndEmpresaId(dados.getUsuarioComposicaoId(),p.getEmpresa().getId()).orElseThrow(()->erro("Operador indisponível."));
        var novas=new ArrayList<ComponenteProdutoEntity>();var usados=new HashSet<Long>();
        for(var linha:dados.getComponentes().stream().sorted(java.util.Comparator.comparing(ComponenteProdutoDTO::produtoId,java.util.Comparator.nullsFirst(java.util.Comparator.naturalOrder()))).toList()) {
            if(linha==null||linha.produtoId()==null||!usados.add(linha.produtoId())||linha.produtoId().equals(p.getId()))throw erro("Componente duplicado ou ciclo na composição.");
            var c=produtos.findByIdAndEmpresaIdWithLock(linha.produtoId(),p.getEmpresa().getId()).orElseThrow(()->erro("Componente indisponível para esta empresa."));
            if(c.isComposto()||!Boolean.TRUE.equals(c.getAtivo())||!Boolean.TRUE.equals(c.getControlaEstoque()))throw erro("Use componentes físicos simples, ativos e com controle de estoque.");
            var n=new ComponenteProdutoEntity();n.empresa=p.getEmpresa();n.produto=p;n.componente=c;n.versao=p.getComposicaoVersao()+1;
            n.quantidade=linha.quantidade();n.fator=linha.fator();n.unidade=linha.unidade()==null?"":linha.unidade().strip().toUpperCase(Locale.ROOT);
            if(n.quantidade==null||n.fator==null||n.quantidade.signum()<=0||n.fator.signum()<=0||n.unidade.isEmpty())throw erro("Informe quantidade, unidade e fator positivos.");
            if(n.unidade.equals(c.getUnidadeMedida())&&n.fator.compareTo(BigDecimal.ONE)!=0)throw erro("Na unidade do estoque o fator deve ser 1.");
            try { if(n.consumoUnitario().signum()<=0 || n.consumoUnitario().precision()>19)throw erro("Consumo deve caber na precisão do estoque (19 dígitos e 3 casas decimais)."); }
            catch(ArithmeticException e) { throw erro("Conversão excede a precisão do estoque (3 casas decimais)."); }
            n.nomeComponente=c.getNome();n.unidadeEstoque=c.getUnidadeMedida();n.usuario=u;n.dataCriacao=TempoNovexa.agora();novas.add(n);
        }
        p.setComposto(true);p.setControlaEstoque(true);p.setPrecoCusto(BigDecimal.ZERO);p.setComposicaoVersao(p.getComposicaoVersao()+1);
        composicoes.saveAllAndFlush(novas);em.flush();em.refresh(p);
    }
    public void validarAlteracaoFisica(ProdutoEntity atual,ProdutoEntity novo) {
        if(composicoes.usadoAtualmente(atual.getEmpresa().getId(),atual.getId()) &&
                (!Objects.equals(atual.getUnidadeMedida(),novo.getUnidadeMedida()) || !Boolean.TRUE.equals(novo.getControlaEstoque())))
            throw erro("Componente em uso: preserve a unidade e o controle de estoque; revise primeiro as composições.");
    }
    public record Necessidade(ProdutoEntity produto,BigDecimal quantidade) { }
    public record Dependente(Long id,String nome) { }
    @Transactional(readOnly=true)
    public List<Dependente> kitsDependentes(Long id,Long empresa) {
        return composicoes.kitsQueUsamAtualmente(empresa,id).stream().map(p->new Dependente(p.getId(),p.getNome())).toList();
    }
    public Map<Long,Necessidade> necessidades(VendaEntity venda,Map<Long,ProdutoEntity> bloqueados) {
        var linhas=atuais(venda.getEmpresa().getId(),venda.getItens().stream().map(i->i.getProduto().getId()).toList());
        Map<Long,Necessidade> resultado=new TreeMap<>();
        for(var item:venda.getItens()) {
            var p=bloqueados.get(item.getProduto().getId());
            if(p.isComposto()) {
                var componentes=linhas.stream().filter(c->c.produto.getId().equals(p.getId())).toList();
                if(componentes.isEmpty())throw erro("O Kit/Combo '"+p.getNome()+"' não possui composição cadastrada. Cadastre os componentes do produto antes de vendê-lo.");
                for(var c:componentes) adicionar(resultado,bloqueados,c.componente.getId(),quantidade(c,item.getQuantidade()),p.getNome());
            } else if(Boolean.TRUE.equals(p.getControlaEstoque())) adicionar(resultado,bloqueados,p.getId(),item.getQuantidade(),null);
        }
        return resultado;
    }
    private void adicionar(Map<Long,Necessidade> r,Map<Long,ProdutoEntity> bloqueados,Long id,BigDecimal quantidade,String nomeDoKit) {
        var p=bloqueados.get(id);
        var origem=nomeDoKit==null?"":" do Kit/Combo '"+nomeDoKit+"'";
        if(p==null)throw erro("A composição"+origem+" mudou e um componente não foi localizado. Remova o item da venda e adicione novamente para carregar a composição atual.");
        if(p.isComposto())throw erro("O componente '"+p.getNome()+"'"+origem+" é um Kit/Combo; componentes devem ser produtos simples. Revise a composição do produto.");
        if(!Boolean.TRUE.equals(p.getAtivo()))throw erro(nomeDoKit==null
                ?"O produto '"+p.getNome()+"' está inativo. Reative o cadastro antes de vender."
                :"O componente '"+p.getNome()+"'"+origem+" está inativo. Reative o produto no cadastro ou revise a composição.");
        if(!Boolean.TRUE.equals(p.getControlaEstoque()))throw erro(nomeDoKit==null
                ?"O produto '"+p.getNome()+"' não controla estoque. Ative 'Controla estoque' no cadastro antes de vender."
                :"O componente '"+p.getNome()+"'"+origem+" não controla estoque e a venda não consegue baixá-lo. Ative 'Controla estoque' no cadastro de '"+p.getNome()+"' ou revise a composição.");
        r.put(id,new Necessidade(p,quantidade.add(r.containsKey(id)?r.get(id).quantidade():BigDecimal.ZERO)));
    }
    private BigDecimal quantidade(ComponenteProdutoEntity c,BigDecimal kits) {
        try{return c.consumoUnitario().multiply(kits).setScale(3,RoundingMode.UNNECESSARY);}
        catch(ArithmeticException e){throw erro("Quantidade do Kit/Combo produz consumo inferior à precisão do estoque.");}
    }
    public void consumir(ItemVendaEntity item,Long usuario,boolean confirmado,MovimentacaoEstoqueService estoque) {
        // Inicializar antes do INSERT evita reler o registro recém-criado e adicioná-lo duas vezes no DTO do rascunho.
        var historico=item.getComponentesConsumidos();
        if(!historico.isEmpty())throw erro("Item já possui consumo registrado. Consulte a venda antes de reenviar.");
        for(var c:atuais(item.getVenda().getEmpresa().getId(),List.of(item.getProduto().getId()))) {
            BigDecimal q=quantidade(c,item.getQuantidade());
            var m=estoque.movimentarSaidaVenda(c.empresa.getId(),c.componente.getId(),usuario,q,
                    "Kit/Combo: venda #"+item.getVenda().getId()+", item #"+item.getId()+", composição v"+c.versao,confirmado);
            var s=new ConsumoKitVendaEntity();s.empresaId=c.empresa.getId();s.vendaId=item.getVenda().getId();s.item=item;s.composicaoId=c.id;
            s.componente=c.componente;s.nome=c.componente.getNome();s.unidade=c.componente.getUnidadeMedida();s.quantidade=q;s.custoUnitario=c.componente.getPrecoCusto();s.movimentoId=m.getId();
            consumos.saveAndFlush(s);historico.add(s);
        }
    }
    private ResponseStatusException erro(String mensagem){return new ResponseStatusException(HttpStatus.CONFLICT,mensagem);}
}
