package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.PagamentoResponseDTO;
import br.com.novexa.erp.entity.PagamentoEntity;
import br.com.novexa.erp.entity.FormaPagamento;
import br.com.novexa.erp.entity.FormaPagamentoEntity;
import br.com.novexa.erp.entity.UsuarioEntity;
import br.com.novexa.erp.entity.VendaEntity;
import br.com.novexa.erp.repository.PagamentoRepository;
import br.com.novexa.erp.repository.VendaRepository;
import br.com.novexa.erp.repository.ConfiguracaoFormaPagamentoEmpresaRepository;
import br.com.novexa.erp.entity.ConfiguracaoFormaPagamentoEmpresaEntity;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class PagamentoService {
    private final PagamentoRepository pagamentos;
    private final VendaRepository vendas;
    private final FormaPagamentoService formas;
    private final CaixaOperacionalService caixa;
    private final ConfiguracaoFormaPagamentoEmpresaRepository configuracoes;
    private final ConfirmacaoPagamentoPixService pix;

    public PagamentoService(PagamentoRepository pagamentos, VendaRepository vendas, FormaPagamentoService formas, CaixaOperacionalService caixa,
            ConfiguracaoFormaPagamentoEmpresaRepository configuracoes, ConfirmacaoPagamentoPixService pix) {
        this.pagamentos = pagamentos;
        this.vendas = vendas;
        this.formas = formas; this.caixa = caixa;
        this.configuracoes = configuracoes;
        this.pix = pix;
    }

    // Uso interno do faturamento, sob o lock da Venda e na mesma transação dos demais efeitos.
    @Transactional(propagation = Propagation.MANDATORY)
    PagamentoEntity registrarFaturamento(VendaEntity venda, UsuarioEntity operador, FormaPagamentoEntity forma) {
        return pagamentos.save(new PagamentoEntity(venda, operador, forma));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    PagamentoEntity registrarFaturamento(VendaEntity venda, UsuarioEntity operador, FormaPagamentoEntity forma,
            ConfiguracaoFormaPagamentoEmpresaEntity configuracao, int sequencia, java.math.BigDecimal valor,
            java.math.BigDecimal recebido) {
        return pagamentos.save(new PagamentoEntity(venda, operador, forma, configuracao, sequencia, valor, recebido));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    FormaPagamentoEntity resolverForma(FormaPagamento legado, Long id) {
        return formas.resolverParaFaturamento(legado, id);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    ConfiguracaoFormaPagamentoEmpresaEntity resolverConfiguracao(Long id, Long empresaId, FormaPagamentoEntity forma) {
        if (id == null) return null;
        // Mantem a configuracao estavel ate o commit, inclusive diante de inativacao concorrente.
        var configuracao = configuracoes.buscarParaAtualizar(id, empresaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Configuracao de pagamento nao encontrada."));
        if (!configuracao.isAtivo())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Configuracao de pagamento inativa.");
        if (forma != null && configuracao.getTipo() != forma.getTipo())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Configuracao incompativel com o tipo da forma de pagamento.");
        if (configuracao.getTipo() == br.com.novexa.erp.entity.TipoFormaPagamento.DEBITO
                || configuracao.getTipo() == br.com.novexa.erp.entity.TipoFormaPagamento.CREDITO) {
            var destino = configuracao.getContaFinanceiraDestino();
            if (destino == null)
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Regularize o destino financeiro da configuracao de cartao antes de uma nova venda.");
            if (!destino.isAtivo() || !destino.getEmpresa().getId().equals(empresaId)
                    || (destino.getTipo() != br.com.novexa.erp.entity.TipoContaFinanceira.BANCO
                        && destino.getTipo() != br.com.novexa.erp.entity.TipoContaFinanceira.CARTEIRA_DIGITAL))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Destino financeiro indisponivel para nova venda com cartao.");
        }
        return configuracao;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void cancelarFaturamento(VendaEntity venda, UsuarioEntity operador) {
        var registros = pagamentos.buscarParaCancelar(venda.getEmpresa().getId(), venda.getId());
        var valorPrazo = venda.getContasReceber().stream().map(br.com.novexa.erp.entity.ContaReceberEntity::getValorOriginal)
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
        if ((registros.isEmpty() && venda.getContasReceber().isEmpty()) || registros.stream().anyMatch(p -> p.getStatus() != br.com.novexa.erp.entity.StatusPagamento.REGISTRADO)
                || registros.stream().map(PagamentoEntity::getValor).reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add)
                        .add(valorPrazo).compareTo(venda.getTotal()) != 0)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Registros financeiros incompatíveis com o cancelamento.");
        if (!registros.isEmpty()) caixa.reverterVenda(venda, registros, operador);
        registros.forEach(p -> pix.estornarNoCancelamento(p, operador));
        registros.forEach(PagamentoEntity::cancelar);
        pagamentos.saveAll(registros);
    }

    public List<PagamentoResponseDTO> listarPorVenda(Long vendaId, Long empresaId) {
        vendas.findByIdAndEmpresaId(vendaId, empresaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Venda não encontrada."));
        return pagamentos.findByEmpresaIdAndVendaIdOrderBySequenciaAsc(empresaId, vendaId)
                .stream().map(PagamentoResponseDTO::de).toList();
    }
}
