package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.util.Paginacao;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Service
@Transactional(readOnly = true)
public class ContaReceberService {
    private final ContaReceberRepository contas;
    private final ClienteRepository clientes;
    private final EmpresaRepository empresas;
    private final MovimentacaoFinanceiraRepository movimentos;
    private final ContaFinanceiraService financeiro;
    private final jakarta.validation.Validator validator;

    public ContaReceberService(ContaReceberRepository contas, ClienteRepository clientes, EmpresaRepository empresas,
            MovimentacaoFinanceiraRepository movimentos, ContaFinanceiraService financeiro, jakarta.validation.Validator validator) {
        this.contas = contas; this.clientes = clientes; this.empresas = empresas;
        this.movimentos = movimentos; this.financeiro = financeiro;
        this.validator = validator;
    }
    public PaginaResponseDTO<ContaReceberResponseDTO> listarPagina(Long empresaId, String termo,
            StatusContaReceber status, Long clienteId, LocalDate vencimentoDe, LocalDate vencimentoAte,
            OrigemContaReceber origem, int page, int size, String sort) {
        var pageable = Paginacao.criar(page, size, sort, Set.of("id", "descricao", "valorOriginal", "valorRecebido",
                "dataEmissao", "dataVencimento", "status", "dataCriacao"), Sort.Direction.ASC);
        if (vencimentoDe != null && vencimentoAte != null && vencimentoDe.isAfter(vencimentoAte))
            throw Paginacao.invalida("Periodo de vencimento invalido.");
        termo = opcional(termo);
        String documento = termo == null ? null : opcional(termo.replaceAll("\\D", ""));
        return PaginaResponseDTO.de(contas.listarPagina(empresaId, termo, documento, status, clienteId,
                vencimentoDe, vencimentoAte, origem, pageable), c -> ContaReceberResponseDTO.de(c, List.of()));
    }
    public ContaReceberResponseDTO buscar(Long id, Long empresaId) {
        return detalhe(contas.findByIdAndEmpresaId(id, empresaId).orElseThrow(() -> naoEncontrada()));
    }
    @Transactional
    public ContaReceberResponseDTO criar(Long empresaId, ContaReceberRequestDTO pedido) {
        validar(pedido);
        var empresa = empresas.findById(empresaId).orElseThrow(() -> naoEncontrada());
        var conta = new ContaReceberEntity(empresa);
        preencher(conta, pedido, empresaId);
        return detalhe(contas.saveAndFlush(conta));
    }
    @Transactional
    public ContaReceberResponseDTO editar(Long id, Long empresaId, ContaReceberRequestDTO pedido) {
        validar(pedido);
        var conta = bloquear(id, empresaId);
        if (conta.getOrigem() != OrigemContaReceber.MANUAL)
            throw conflito("Conta originada de venda nao pode ser editada individualmente.");
        if (conta.getStatus() != StatusContaReceber.PENDENTE || movimentos.existsByContaReceberIdAndEmpresaId(id, empresaId))
            throw conflito("Conta com historico de recebimento ou cancelada nao pode ser editada.");
        preencher(conta, pedido, empresaId);
        return detalhe(contas.saveAndFlush(conta));
    }
    @Transactional
    public ContaReceberResponseDTO receber(Long id, Long empresaId, Long usuarioId, ContaReceberBaixaDTO pedido) {
        validar(pedido);
        // A conta serializa baixas, estornos, edicao e cancelamento antes do lock do destino financeiro.
        var conta = bloquear(id, empresaId);
        var anterior = movimentos.findByEmpresaIdAndChaveRequisicao(empresaId, pedido.chaveRequisicao());
        if (anterior.isPresent()) {
            var m = anterior.get();
            if (!m.getContaReceber().getId().equals(id) || !m.getContaFinanceira().getId().equals(pedido.contaFinanceiraId())
                    || m.getValor().compareTo(pedido.valor()) != 0 || !m.getDataMovimento().equals(pedido.dataRecebimento())
                    || !Objects.equals(m.getObservacao(), opcional(pedido.observacao())))
                throw conflito("Chave de requisicao ja utilizada com dados diferentes.");
            return detalhe(conta);
        }
        if (conta.getStatus() == StatusContaReceber.CANCELADA || conta.getStatus() == StatusContaReceber.RECEBIDA)
            throw conflito("Conta nao aceita novos recebimentos.");
        var valor = dinheiro(pedido.valor());
        if (valor.compareTo(conta.getSaldo()) > 0) throw conflito("Recebimento excede o saldo da conta.");
        financeiro.registrarEntradaContaReceber(conta, usuarioId, pedido);
        conta.aplicarRecebimento(valor);
        return detalhe(contas.saveAndFlush(conta));
    }
    @Transactional
    public ContaReceberResponseDTO estornar(Long id, Long movimentoId, Long empresaId, Long usuarioId,
            MovimentacaoFinanceiraEstornoDTO pedido) {
        validar(pedido);
        var conta = bloquear(id, empresaId);
        if (!movimentos.existsByIdAndContaReceberIdAndEmpresaId(movimentoId, id, empresaId))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Recebimento nao encontrado nesta conta.");
        var valor = financeiro.estornarEntradaContaReceber(movimentoId, empresaId, usuarioId, pedido.motivoEstorno().trim());
        conta.aplicarRecebimento(valor.negate());
        return detalhe(contas.saveAndFlush(conta));
    }
    @Transactional
    public ContaReceberResponseDTO cancelar(Long id, Long empresaId) {
        var conta = bloquear(id, empresaId);
        if (conta.getOrigem() != OrigemContaReceber.MANUAL)
            throw conflito("Cancele a venda para reverter suas contas a receber.");
        if (conta.getValorRecebido().signum() != 0) throw conflito("Estorne os recebimentos antes de cancelar a conta.");
        if (conta.getStatus() != StatusContaReceber.CANCELADA) conta.cancelar();
        return detalhe(contas.saveAndFlush(conta));
    }
    public ResumoContasReceberDTO resumo(Long empresaId) {
        var hoje = LocalDate.now();
        return new ResumoContasReceberDTO(total(contas.resumirAbertas(empresaId, null, hoje.minusDays(1))),
                total(contas.resumirAbertas(empresaId, hoje, hoje.plusDays(7))),
                total(contas.resumirAbertas(empresaId, hoje, hoje.plusDays(30))),
                total(contas.resumirAbertas(empresaId, null, null)),
                total(movimentos.resumirRecebimentos(empresaId, hoje.withDayOfMonth(1), hoje.withDayOfMonth(hoje.lengthOfMonth()))));
    }
    public void validarParcelasVenda(VendaEntity venda, List<ParcelaPrazoVendaDTO> parcelas) {
        if (parcelas == null) return;
        if (parcelas.isEmpty() || parcelas.size() > 120) throw Paginacao.invalida("Informe de 1 a 120 parcelas a prazo.");
        if (venda.getCliente() == null) throw conflito("Selecione um cliente para vender a prazo.");
        var cliente = clientes.findByIdAndEmpresaId(venda.getCliente().getId(), venda.getEmpresa().getId())
                .filter(c -> Boolean.TRUE.equals(c.getAtivo())).orElseThrow(() -> conflito("Cliente indisponivel para venda a prazo."));
        if (!cliente.getId().equals(venda.getCliente().getId())) throw conflito("Cliente invalido.");
        parcelas.forEach(p -> { validar(p); dinheiro(p.valor()); });
    }
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void gerarDaVenda(VendaEntity venda, List<ParcelaPrazoVendaDTO> parcelas) {
        if (parcelas == null) return;
        validarParcelasVenda(venda, parcelas);
        for (int i = 0; i < parcelas.size(); i++) {
            var p = parcelas.get(i);
            var conta = contas.saveAndFlush(ContaReceberEntity.daVenda(venda, dinheiro(p.valor()), p.vencimento(), i + 1, parcelas.size()));
            venda.getContasReceber().add(conta);
        }
    }
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public List<ContaReceberEntity> bloquearDaVenda(VendaEntity venda) {
        return contas.bloquearDaVenda(venda.getId(), venda.getEmpresa().getId());
    }
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void cancelarDaVenda(List<ContaReceberEntity> registros, Long empresaId, Long usuarioId, Long vendaId) {
        for (var conta : registros) {
            if (conta.getStatus() == StatusContaReceber.CANCELADA) continue;
            for (var movimento : movimentos.findByContaReceberIdAndEmpresaIdOrderByIdAsc(conta.getId(), empresaId)) {
                if (!movimento.isEstornada()) {
                    var valor = financeiro.estornarEntradaContaReceber(movimento.getId(), empresaId, usuarioId,
                            "Cancelamento da venda " + vendaId);
                    conta.aplicarRecebimento(valor.negate());
                }
            }
            if (conta.getValorRecebido().signum() != 0) throw conflito("Historico de recebimentos inconsistente.");
            conta.cancelar();
        }
        contas.saveAllAndFlush(registros);
    }
    private ResumoContasReceberDTO.Total total(ContaReceberRepository.Total t) {
        return new ResumoContasReceberDTO.Total(t.getTotal(), t.getQuantidade());
    }
    private void preencher(ContaReceberEntity conta, ContaReceberRequestDTO pedido, Long empresaId) {
        int numero = pedido.numeroParcela() == null ? 1 : pedido.numeroParcela();
        int total = pedido.totalParcelas() == null ? 1 : pedido.totalParcelas();
        if (numero < 1 || total < 1 || numero > total) throw Paginacao.invalida("Metadados de parcela invalidos.");
        var cliente = clientes.findByIdAndEmpresaId(pedido.clienteId(), empresaId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Cliente nao encontrado."));
        if (!Boolean.TRUE.equals(cliente.getAtivo())) throw conflito("Cliente inativo nao aceita novas contas.");
        conta.editar(cliente, pedido.descricao().trim(), dinheiro(pedido.valorOriginal()), pedido.dataEmissao(),
                pedido.dataVencimento(), numero, total, opcional(pedido.observacao()));
    }
    private BigDecimal dinheiro(BigDecimal valor) {
        if (valor == null || valor.signum() <= 0 || valor.scale() > 2 || valor.precision() - valor.scale() > 17)
            throw Paginacao.invalida("Valor deve ser positivo e possuir no maximo duas casas decimais.");
        return valor.setScale(2, RoundingMode.UNNECESSARY);
    }
    private ContaReceberEntity bloquear(Long id, Long empresaId) {
        return contas.buscarParaAlterar(id, empresaId).orElseThrow(() -> naoEncontrada());
    }
    private ContaReceberResponseDTO detalhe(ContaReceberEntity c) {
        return ContaReceberResponseDTO.de(c, movimentos.findByContaReceberIdAndEmpresaIdOrderByIdAsc(c.getId(),
                c.getEmpresa().getId()).stream().map(MovimentacaoFinanceiraResponseDTO::de).toList());
    }
    private ResponseStatusException naoEncontrada() { return new ResponseStatusException(HttpStatus.NOT_FOUND, "Conta a receber nao encontrada."); }
    private ResponseStatusException conflito(String mensagem) { return new ResponseStatusException(HttpStatus.CONFLICT, mensagem); }
    private String opcional(String texto) { return texto == null || texto.isBlank() ? null : texto.trim(); }
    private void validar(Object pedido) {
        if (pedido == null || !validator.validate(pedido).isEmpty()) throw Paginacao.invalida("Dados da conta ou recebimento invalidos.");
    }
}
