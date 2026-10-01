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
    private final br.com.novexa.erp.repository.LancamentoFinanceiroRepository financeiro;

    public PagamentoService(PagamentoRepository pagamentos, VendaRepository vendas, FormaPagamentoService formas, CaixaOperacionalService caixa,
            br.com.novexa.erp.repository.LancamentoFinanceiroRepository financeiro,
            ConfiguracaoFormaPagamentoEmpresaRepository configuracoes, ConfirmacaoPagamentoPixService pix) {
        this.pagamentos = pagamentos;
        this.vendas = vendas;
        this.formas = formas; this.caixa = caixa; this.financeiro = financeiro;
        this.configuracoes = configuracoes;
        this.pix = pix;
    }

    // Uso interno do faturamento, sob o lock da Venda e na mesma transação dos demais efeitos.
    @Transactional(propagation = Propagation.MANDATORY)
    PagamentoEntity registrarFaturamento(VendaEntity venda, UsuarioEntity operador, FormaPagamentoEntity forma) {
        return pagamentos.save(new PagamentoEntity(venda, operador, forma));
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
        if (configuracao.getTipo() != forma.getTipo())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Configuracao incompativel com o tipo da forma de pagamento.");
        return configuracao;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void cancelarFaturamento(VendaEntity venda, UsuarioEntity operador) {
        var registros = pagamentos.buscarParaCancelar(venda.getEmpresa().getId(), venda.getId());
        var lancamento = financeiro.findByVendaIdAndEmpresaId(venda.getId(), venda.getEmpresa().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Lançamento financeiro original não encontrado."));
        if (registros.isEmpty() || registros.stream().anyMatch(p -> p.getStatus() != br.com.novexa.erp.entity.StatusPagamento.REGISTRADO)
                || registros.stream().map(PagamentoEntity::getValor).reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add)
                        .compareTo(venda.getTotal()) != 0
                || lancamento.getSituacao() == br.com.novexa.erp.entity.LancamentoFinanceiroEntity.Situacao.CANCELADO)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Registros financeiros incompatíveis com o cancelamento.");
        caixa.reverterVenda(venda, registros, operador);
        registros.forEach(p -> pix.estornarNoCancelamento(p, operador));
        registros.forEach(PagamentoEntity::cancelar);
        pagamentos.saveAll(registros);
        lancamento.cancelar();
        financeiro.saveAndFlush(lancamento);
    }

    public List<PagamentoResponseDTO> listarPorVenda(Long vendaId, Long empresaId) {
        vendas.findByIdAndEmpresaId(vendaId, empresaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Venda não encontrada."));
        return pagamentos.findByEmpresaIdAndVendaIdOrderBySequenciaAsc(empresaId, vendaId)
                .stream().map(PagamentoResponseDTO::de).toList();
    }
}
