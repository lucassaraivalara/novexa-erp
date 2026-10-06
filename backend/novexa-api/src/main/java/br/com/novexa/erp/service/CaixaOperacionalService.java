package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import jakarta.persistence.EntityManager;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
@Transactional
public class CaixaOperacionalService {
    private final CaixaRepository caixas;
    private final SessaoCaixaRepository sessoes;
    private final PagamentoRepository pagamentos;
    private final MovimentacaoCaixaRepository movimentos;
    private final UsuarioRepository usuarios;
    private final VendaRepository vendas;
    private final ConferenciaFechamentoCaixaRepository conferencias;
    private final EntityManager em;

    public CaixaOperacionalService(CaixaRepository caixas, SessaoCaixaRepository sessoes, PagamentoRepository pagamentos,
            MovimentacaoCaixaRepository movimentos, UsuarioRepository usuarios, VendaRepository vendas,
            ConferenciaFechamentoCaixaRepository conferencias, EntityManager em) {
        this.caixas = caixas; this.sessoes = sessoes; this.pagamentos = pagamentos; this.movimentos = movimentos;
        this.usuarios = usuarios; this.vendas = vendas; this.conferencias = conferencias; this.em = em;
    }

    @Transactional(readOnly = true)
    public List<SessaoCaixaAbertaDTO> abertas(Long empresaId) {
        return sessoes.findByEmpresaIdAndStatusOrderByDataAberturaAscIdAsc(empresaId, StatusSessaoCaixa.ABERTO)
                .stream().map(SessaoCaixaAbertaDTO::de).toList();
    }

    @Transactional(readOnly = true)
    public List<SessaoCaixaHistoricoDTO> fechadas(UsuarioAutenticado usuario) {
        return sessoes.findByEmpresaIdAndStatusOrderByDataFechamentoDescIdDesc(usuario.empresaId(), StatusSessaoCaixa.FECHADO)
                .stream().filter(sessao -> podeVer(sessao, usuario))
                .map(sessao -> SessaoCaixaHistoricoDTO.de(sessao, calcular(sessao))).toList();
    }

    @Transactional(readOnly = true)
    public void exigirAcessoLeitura(Long sessaoId, UsuarioAutenticado usuario) {
        var sessao = sessoes.findByIdAndEmpresaId(sessaoId, usuario.empresaId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Sessão de Caixa não encontrada."));
        if (!podeVer(sessao, usuario))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente quem abriu o Caixa pode ver esta sessão.");
    }

    @Transactional(readOnly = true)
    public SessaoCaixaDetalheDTO detalhe(Long sessaoId, UsuarioAutenticado usuario) {
        var sessao = sessoes.findByIdAndEmpresaId(sessaoId, usuario.empresaId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Sessão de Caixa não encontrada."));
        if (sessao.getStatus() != StatusSessaoCaixa.FECHADO)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Sessão de Caixa ainda aberta.");
        if (!podeVer(sessao, usuario))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente quem abriu o Caixa pode ver esta sessão.");
        var resumo = calcular(sessao);
        var eventos = new ArrayList<SessaoCaixaDetalheDTO.Evento>();
        eventos.add(new SessaoCaixaDetalheDTO.Evento("ABERTURA", sessao.getDataAbertura(), sessao.getSaldoInicial(), null, null));
        for (var venda : vendas.findByEmpresaIdAndSessaoCaixaIdOrderByDataHoraAscIdAsc(usuario.empresaId(), sessaoId)) {
            eventos.add(new SessaoCaixaDetalheDTO.Evento(venda.getStatus() == StatusVenda.CANCELADA ? "VENDA_CANCELADA" : "VENDA",
                    venda.getDataHora(), venda.getTotal(), venda.getId(), null));
        }
        for (var movimento : movimentos.findBySessaoIdAndEmpresaIdOrderByIdAsc(sessaoId, usuario.empresaId())) {
            if (movimento.getTipo() == TipoMovimentacaoCaixa.VENDA ||
                    (movimento.getTipo() == TipoMovimentacaoCaixa.SUPRIMENTO
                            && "Saldo inicial / Abertura de caixa".equals(movimento.getObservacao()))) continue;
            eventos.add(new SessaoCaixaDetalheDTO.Evento(movimento.getTipo().name(), movimento.getDataHora(),
                    movimento.getValor(), movimento.getPagamento() == null ? null : movimento.getPagamento().getVenda().getId(),
                    movimento.getObservacao()));
        }
        eventos.add(new SessaoCaixaDetalheDTO.Evento("FECHAMENTO", sessao.getDataFechamento(), sessao.getSaldoFinal(), null, null));
        eventos.sort(Comparator.comparing(SessaoCaixaDetalheDTO.Evento::dataHora));
        return new SessaoCaixaDetalheDTO(SessaoCaixaHistoricoDTO.de(sessao, resumo), resumo,
                sessao.getModalidadeConferencia(), sessao.getObservacaoFechamento(),
                conferencias.findBySessaoIdAndEmpresaIdOrderByIdAsc(sessaoId, usuario.empresaId()).stream()
                        .map(ConferenciaFechamentoCaixaDTO::de).toList(), eventos);
    }

    private boolean podeVer(SessaoCaixaEntity sessao, UsuarioAutenticado usuario) {
        return sessao.getStatus() != StatusSessaoCaixa.FECHADO || usuario.perfil() == PerfilUsuario.ADMIN
                || usuario.perfil() == PerfilUsuario.GERENTE
                || sessao.getUsuarioAbertura().getId().equals(usuario.usuarioId());
    }

    // Venda, movimentação manual, resumo e fechamento compartilham o lock desta sessão.
    @Transactional(propagation = Propagation.MANDATORY)
    public SessaoCaixaEntity bloquear(Long sessaoId, Long empresaId) {
        var sessao = sessoes.bloquear(sessaoId, empresaId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Sessão de Caixa não encontrada."));
        em.refresh(sessao);
        return sessao;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public SessaoCaixaEntity resolverSessao(Long id, Long empresaId, Long usuarioId) {
        if (id == null) {
            var abertas = sessoes.findByEmpresaIdAndUsuarioAberturaIdAndStatus(empresaId, usuarioId, StatusSessaoCaixa.ABERTO);
            if (abertas.isEmpty()) throw conflito("Abra uma sessão de Caixa antes de faturar a venda.");
            if (abertas.size() != 1) throw conflito("Há mais de uma sessão aberta para este operador. Informe sessaoCaixaId.");
            id = abertas.getFirst().getId();
        }
        var referencia = sessoes.findByIdAndEmpresaId(id, empresaId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Sessão de Caixa não encontrada."));
        if (!referencia.getUsuarioAbertura().getId().equals(usuarioId))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "A sessão de Caixa deve pertencer ao operador autenticado.");
        caixas.buscarComLock(referencia.getCaixa().getId(), empresaId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Caixa não encontrado."));
        var sessao = bloquear(id, empresaId);
        exigirAberta(sessao);
        return sessao;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void registrarVenda(PagamentoEntity pagamento) {
        if (pagamento.getFormaPagamento() != FormaPagamento.DINHEIRO) return;
        var sessao = pagamento.getVenda().getSessaoCaixa();
        exigirAberta(sessao);
        UUID chave = UUID.nameUUIDFromBytes(("pagamento:" + pagamento.getId()).getBytes(StandardCharsets.UTF_8));
        movimentos.saveAndFlush(new MovimentacaoCaixaEntity(sessao, pagamento.getUsuario(), pagamento,
                chave, TipoMovimentacaoCaixa.VENDA, pagamento.getValor(), null));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void registrarSaldoInicial(SessaoCaixaEntity sessao, UsuarioEntity usuario, BigDecimal valor) {
        UUID chave = UUID.nameUUIDFromBytes(("saldo-inicial:" + sessao.getId()).getBytes(StandardCharsets.UTF_8));
        movimentos.save(new MovimentacaoCaixaEntity(sessao, usuario, null, chave,
                TipoMovimentacaoCaixa.SUPRIMENTO, valor, "Saldo inicial / Abertura de caixa"));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void reverterVenda(VendaEntity venda, List<PagamentoEntity> registros, UsuarioEntity operador) {
        // Vendas anteriores à sessão operacional não tiveram entrada física neste domínio.
        if (venda.getSessaoCaixa() == null) return;
        var sessao = bloquear(venda.getSessaoCaixa().getId(), venda.getEmpresa().getId());
        exigirAberta(sessao);
        for (var pagamento : registros) {
            if (pagamento.getFormaPagamento() != FormaPagamento.DINHEIRO) continue;
            var original = movimentos.findByPagamentoIdAndTipoAndSessaoIdAndEmpresaId(pagamento.getId(),
                    TipoMovimentacaoCaixa.VENDA, sessao.getId(), venda.getEmpresa().getId())
                    .orElseThrow(() -> conflito("Entrada original de dinheiro não encontrada."));
            if (original.getValor().compareTo(pagamento.getValor()) != 0)
                throw conflito("Entrada original incompatível com o pagamento.");
            var anterior = movimentos.findByPagamentoIdAndTipoAndSessaoIdAndEmpresaId(pagamento.getId(),
                    TipoMovimentacaoCaixa.ESTORNO_VENDA, sessao.getId(), venda.getEmpresa().getId());
            if (anterior.isPresent()) throw conflito("Pagamento já possui estorno de Caixa.");
            UUID chave = UUID.nameUUIDFromBytes(("estorno-pagamento:" + pagamento.getId()).getBytes(StandardCharsets.UTF_8));
            movimentos.save(new MovimentacaoCaixaEntity(sessao, operador, pagamento, chave,
                    TipoMovimentacaoCaixa.ESTORNO_VENDA, original.getValor(),
                    "Cancelamento da venda " + venda.getId() + "; estorno do movimento " + original.getId()));
        }
    }

    public MovimentacaoCaixaResponseDTO movimentar(Long sessaoId, MovimentacaoCaixaRequestDTO pedido,
            UsuarioAutenticado autenticado) {
        if (pedido.chaveRequisicao() == null || pedido.tipo() == null || (pedido.tipo() != TipoMovimentacaoCaixa.SUPRIMENTO && pedido.tipo() != TipoMovimentacaoCaixa.SANGRIA)
                || pedido.valor() == null || pedido.valor().signum() <= 0 || pedido.valor().scale() > 2
                || pedido.valor().precision() - pedido.valor().scale() > 12
                || (pedido.observacao() != null && pedido.observacao().length() > 500))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe SUPRIMENTO ou SANGRIA e valor positivo com até duas casas decimais.");
        var usuario = usuarios.findByIdAndEmpresaId(autenticado.usuarioId(), autenticado.empresaId())
                .filter(u -> Boolean.TRUE.equals(u.getAtivo()) && Boolean.TRUE.equals(u.getEmpresa().getAtivo()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Operador indisponível."));
        var sessao = bloquear(sessaoId, autenticado.empresaId());
        var existente = movimentos.findBySessaoIdAndEmpresaIdAndChaveRequisicao(sessaoId, autenticado.empresaId(), pedido.chaveRequisicao());
        if (existente.isPresent()) {
            var m = existente.get();
            if (m.getTipo() != pedido.tipo() || m.getValor().compareTo(pedido.valor()) != 0
                    || !Objects.equals(m.getObservacao(), pedido.observacao())
                    || !m.getUsuario().getId().equals(usuario.getId()))
                throw conflito("Chave de requisição já utilizada com outros dados.");
            return MovimentacaoCaixaResponseDTO.de(m);
        }
        exigirAberta(sessao);
        if (pedido.tipo() == TipoMovimentacaoCaixa.SANGRIA
                && calcular(sessao).saldoEsperadoDinheiro().compareTo(pedido.valor()) < 0)
            throw conflito("Saldo em dinheiro insuficiente para sangria.");
        return MovimentacaoCaixaResponseDTO.de(movimentos.saveAndFlush(new MovimentacaoCaixaEntity(
                sessao, usuario, null, pedido.chaveRequisicao(), pedido.tipo(), pedido.valor(), pedido.observacao())));
    }

    public ResumoSessaoCaixaDTO resumo(Long sessaoId, Long empresaId) {
        return calcular(bloquear(sessaoId, empresaId));
    }

    @Transactional(readOnly = true)
    public List<MovimentacaoCaixaResponseDTO> listarMovimentos(Long sessaoId, Long empresaId) {
        sessoes.findByIdAndEmpresaId(sessaoId, empresaId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Sessão de Caixa não encontrada."));
        return movimentos.findBySessaoIdAndEmpresaIdOrderByIdAsc(sessaoId, empresaId)
                .stream().map(MovimentacaoCaixaResponseDTO::de).toList();
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public ResumoSessaoCaixaDTO calcular(SessaoCaixaEntity sessao) {
        var registros = pagamentos.findByEmpresaIdAndVendaSessaoCaixaIdOrderByIdAsc(sessao.getEmpresa().getId(), sessao.getId());
        Map<Long, ResumoSessaoCaixaDTO.TotalForma> porForma = new LinkedHashMap<>();
        BigDecimal total = BigDecimal.ZERO;
        for (var p : registros) {
            if (p.getStatus() == StatusPagamento.CANCELADO) continue;
            total = total.add(p.getValor());
            var anterior = porForma.get(p.getForma().getId());
            String tipo = switch (p.getFormaPagamento()) {
                case DINHEIRO -> "DINHEIRO"; case PIX -> "PIX";
                case CARTAO_DEBITO -> "DEBITO"; case CARTAO_CREDITO -> "CREDITO";
            };
            porForma.put(p.getForma().getId(), new ResumoSessaoCaixaDTO.TotalForma(p.getForma().getId(),
                    p.getForma().getDescricao(), tipo, p.getValor().add(anterior == null ? BigDecimal.ZERO : anterior.total())));
        }
        BigDecimal dinheiro = BigDecimal.ZERO, suprimentos = BigDecimal.ZERO, sangrias = BigDecimal.ZERO;
        for (var m : movimentos.findBySessaoIdAndEmpresaIdOrderByIdAsc(sessao.getId(), sessao.getEmpresa().getId())) {
            if (m.getTipo() == TipoMovimentacaoCaixa.SUPRIMENTO
                    && "Saldo inicial / Abertura de caixa".equals(m.getObservacao())) continue;
            switch (m.getTipo()) {
                case VENDA -> dinheiro = dinheiro.add(m.getValor());
                case ESTORNO_VENDA -> dinheiro = dinheiro.subtract(m.getValor());
                case SUPRIMENTO -> suprimentos = suprimentos.add(m.getValor());
                case SANGRIA -> sangrias = sangrias.add(m.getValor());
            }
        }
        var esperado = sessao.getSaldoInicial().add(dinheiro).add(suprimentos).subtract(sangrias);
        return new ResumoSessaoCaixaDTO(sessao.getId(), sessao.getCaixa().getId(), sessao.getStatus(),
                sessao.getSaldoInicial(), total, List.copyOf(porForma.values()), suprimentos, sangrias,
            esperado, sessao.getSaldoFinal(), sessao.getSaldoFinal() == null ? null : sessao.getSaldoFinal().subtract(esperado),
            sessao.getCaixa().getDescricao(), sessao.getDataAbertura(),
            new ResumoSessaoCaixaDTO.Operador(sessao.getUsuarioAbertura().getId(), sessao.getUsuarioAbertura().getNomeUsuario()));
    }

    private void exigirAberta(SessaoCaixaEntity sessao) {
        if (sessao == null || sessao.getStatus() != StatusSessaoCaixa.ABERTO)
            throw conflito("Sessão de Caixa fechada.");
    }
    private ResponseStatusException conflito(String mensagem) {
        return new ResponseStatusException(HttpStatus.CONFLICT, mensagem);
    }
}
