package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import jakarta.validation.Validator;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

@Service
public class TransferenciaFinanceiraService {
    private final TransferenciaFinanceiraRepository transferencias;
    private final ContaFinanceiraRepository contas;
    private final MovimentacaoFinanceiraRepository movimentos;
    private final UsuarioRepository usuarios;
    private final TransactionTemplate transacao;
    private final Validator validator;

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public br.com.novexa.erp.dto.PaginaResponseDTO<TransferenciaFinanceiraResponseDTO> listarPagina(Long empresaId, Long contaOrigemId, Long contaDestinoId, br.com.novexa.erp.entity.StatusTransferenciaFinanceira status, java.time.LocalDate dataInicial, java.time.LocalDate dataFinal, int page, int size, String sort) {
        var pageable = br.com.novexa.erp.util.Paginacao.criar(page, size, sort,
                java.util.Set.of("id", "dataMovimento", "valor", "status"), org.springframework.data.domain.Sort.Direction.DESC);
        if (dataInicial != null && dataFinal != null && dataInicial.isAfter(dataFinal))
            throw br.com.novexa.erp.util.Paginacao.invalida("Periodo invalido.");

        return br.com.novexa.erp.dto.PaginaResponseDTO.de(transferencias.listarPagina(empresaId, contaOrigemId, contaDestinoId, status, dataInicial, dataFinal, pageable), TransferenciaFinanceiraResponseDTO::de);
    }


    public TransferenciaFinanceiraService(TransferenciaFinanceiraRepository transferencias,
            ContaFinanceiraRepository contas, MovimentacaoFinanceiraRepository movimentos,
            UsuarioRepository usuarios, PlatformTransactionManager transactionManager, Validator validator) {
        this.transferencias = transferencias;
        this.contas = contas;
        this.movimentos = movimentos;
        this.usuarios = usuarios;
        this.transacao = new TransactionTemplate(transactionManager);
        this.validator = validator;
    }

    public TransferenciaFinanceiraResponseDTO criar(Long empresaId, Long usuarioId, TransferenciaFinanceiraCriacaoDTO p) {
        validar(p);
        try {
            return transacao.execute(status -> criarNaTransacao(empresaId, usuarioId, p));
        } catch (DataIntegrityViolationException erro) {
            // A chave pode vencer em outra transação, inclusive usando contas diferentes.
            // Releitura ocorre somente depois do rollback completo da tentativa perdedora.
            return transacao.execute(status -> transferencias.findByEmpresaIdAndChaveRequisicao(empresaId, p.chaveRequisicao())
                    .map(t -> replay(t, p)).orElseThrow(() -> erro));
        }
    }

    private TransferenciaFinanceiraResponseDTO criarNaTransacao(Long empresaId, Long usuarioId, TransferenciaFinanceiraCriacaoDTO p) {
        var existente = transferencias.findByEmpresaIdAndChaveRequisicao(empresaId, p.chaveRequisicao());
        if (existente.isPresent()) return replay(existente.get(), p);
        if (p.contaOrigemId().equals(p.contaDestinoId()))
            throw erro(HttpStatus.BAD_REQUEST, "Origem e destino devem ser diferentes.");
        var par = bloquearContas(empresaId, p.contaOrigemId(), p.contaDestinoId());
        existente = transferencias.findByEmpresaIdAndChaveRequisicao(empresaId, p.chaveRequisicao());
        if (existente.isPresent()) return replay(existente.get(), p);
        var origem = par[0];
        var destino = par[1];
        validarNovaConta(origem, empresaId);
        validarNovaConta(destino, empresaId);
        validarSaldo(origem.getSaldoAtual().subtract(p.valor()));
        validarSaldo(destino.getSaldoAtual().add(p.valor()));
        var usuario = usuario(usuarioId, empresaId);
        var t = transferencias.saveAndFlush(new TransferenciaFinanceiraEntity(origem, destino, p.valor(),
                p.dataMovimento(), opcional(p.observacao()), usuario, p.chaveRequisicao()));
        origem.aplicar(p.valor().negate());
        destino.aplicar(p.valor());
        movimentos.saveAndFlush(MovimentacaoFinanceiraEntity.daTransferencia(t, TipoMovimentacaoFinanceira.SAIDA));
        movimentos.saveAndFlush(MovimentacaoFinanceiraEntity.daTransferencia(t, TipoMovimentacaoFinanceira.ENTRADA));
        return TransferenciaFinanceiraResponseDTO.de(t);
    }

    @Transactional(readOnly = true)
    public List<TransferenciaFinanceiraResponseDTO> listar(Long empresaId) {
        return transferencias.findByEmpresaIdOrderByDataMovimentoDescIdDesc(empresaId).stream()
                .map(TransferenciaFinanceiraResponseDTO::de).toList();
    }

    @Transactional
    public TransferenciaFinanceiraResponseDTO estornar(Long id, Long empresaId, Long usuarioId,
            MovimentacaoFinanceiraEstornoDTO p) {
        validar(p);
        // Projeção evita carregar saldos antes dos locks. Contas sempre precedem o agregado.
        var ids = transferencias.buscarContas(id, empresaId).orElseThrow(() ->
                erro(HttpStatus.NOT_FOUND, "Transferência não encontrada."));
        var par = bloquearContas(empresaId, ids.getOrigemId(), ids.getDestinoId());
        var t = transferencias.buscarParaEstornar(id, empresaId).orElseThrow(() ->
                erro(HttpStatus.NOT_FOUND, "Transferência não encontrada."));
        if (t.getStatus() == StatusTransferenciaFinanceira.ESTORNADA)
            throw erro(HttpStatus.CONFLICT, "Transferência já estornada.");
        validarSaldo(par[1].getSaldoAtual().subtract(t.getValor()));
        validarSaldo(par[0].getSaldoAtual().add(t.getValor()));
        var efeitos = movimentos.findByEmpresaIdAndTransferenciaIdOrderByIdAsc(empresaId, id);
        if (efeitos.size() != 2 || efeitos.stream().anyMatch(MovimentacaoFinanceiraEntity::isEstornada)
                || efeitos.stream().filter(m -> m.getTipo() == TipoMovimentacaoFinanceira.SAIDA
                    && m.getContaFinanceira().getId().equals(ids.getOrigemId())).count() != 1
                || efeitos.stream().filter(m -> m.getTipo() == TipoMovimentacaoFinanceira.ENTRADA
                    && m.getContaFinanceira().getId().equals(ids.getDestinoId())).count() != 1)
            throw erro(HttpStatus.CONFLICT, "Histórico da transferência inconsistente.");
        var usuario = usuario(usuarioId, empresaId);
        par[0].aplicar(t.getValor());
        par[1].aplicar(t.getValor().negate());
        efeitos.forEach(m -> m.estornar(usuario, p.motivoEstorno().trim()));
        t.estornar(usuario, p.motivoEstorno().trim());
        movimentos.flush();
        return TransferenciaFinanceiraResponseDTO.de(t);
    }

    private ContaFinanceiraEntity[] bloquearContas(Long empresaId, Long origem, Long destino) {
        var menor = conta(Math.min(origem, destino), empresaId);
        var maior = conta(Math.max(origem, destino), empresaId);
        return origem.equals(menor.getId()) ? new ContaFinanceiraEntity[]{menor, maior}
                : new ContaFinanceiraEntity[]{maior, menor};
    }

    private ContaFinanceiraEntity conta(Long id, Long empresaId) {
        return contas.buscarParaAlterar(id, empresaId).orElseThrow(() ->
                erro(HttpStatus.NOT_FOUND, "Conta financeira não encontrada."));
    }

    private void validarNovaConta(ContaFinanceiraEntity conta, Long empresaId) {
        if (!conta.getEmpresa().getId().equals(empresaId))
            throw erro(HttpStatus.NOT_FOUND, "Conta financeira não encontrada.");
        if (!conta.isAtivo()) throw erro(HttpStatus.CONFLICT, "Conta financeira inativa.");
        if (conta.getTipo() == TipoContaFinanceira.CAIXA || conta.getTipo() == TipoContaFinanceira.ADQUIRENTE)
            throw erro(HttpStatus.CONFLICT, "Tipo legado não permite transferências.");
    }

    private TransferenciaFinanceiraResponseDTO replay(TransferenciaFinanceiraEntity t, TransferenciaFinanceiraCriacaoDTO p) {
        if (!t.getContaOrigem().getId().equals(p.contaOrigemId())
                || !t.getContaDestino().getId().equals(p.contaDestinoId())
                || t.getValor().compareTo(p.valor()) != 0 || !t.getDataMovimento().equals(p.dataMovimento())
                || !Objects.equals(t.getObservacao(), opcional(p.observacao())))
            throw erro(HttpStatus.CONFLICT, "Chave de requisição já utilizada com dados diferentes.");
        return TransferenciaFinanceiraResponseDTO.de(t);
    }

    private UsuarioEntity usuario(Long id, Long empresaId) {
        return usuarios.findByIdAndEmpresaId(id, empresaId).orElseThrow(() ->
                erro(HttpStatus.NOT_FOUND, "Usuário não encontrado."));
    }

    private void validar(Object p) {
        if (p == null || !validator.validate(p).isEmpty())
            throw erro(HttpStatus.BAD_REQUEST, "Dados da transferência inválidos.");
    }

    private void validarSaldo(BigDecimal saldo) {
        if (saldo.signum() < 0) throw erro(HttpStatus.CONFLICT, "Saldo insuficiente para esta operação.");
        if (saldo.precision() - saldo.scale() > 17)
            throw erro(HttpStatus.CONFLICT, "Saldo excede o limite permitido.");
    }

    private String opcional(String texto) { return texto == null || texto.isBlank() ? null : texto.trim(); }
    private ResponseStatusException erro(HttpStatus status, String mensagem) { return new ResponseStatusException(status, mensagem); }
}
