package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.time.LocalDateTime;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class SessaoCaixaService {
    private final CofreService cofre;
    private final TransactionTemplate aberturaTransacao;
    private final CaixaRepository caixas;
    private final SessaoCaixaRepository sessoes;
    private final UsuarioRepository usuarios;
    private final CaixaOperacionalService operacional;
    private final ConferenciaFechamentoCaixaRepository conferencias;
    private final FormaPagamentoRepository formas;
    private final AberturaCaixaOrigemRepository aberturasOrigem;
    private final RecolhimentoCofreRepository registrosCofre;
    private final ContaFinanceiraRepository contas;

    public SessaoCaixaService(CaixaRepository caixas, SessaoCaixaRepository sessoes, UsuarioRepository usuarios,
            CaixaOperacionalService operacional, ConferenciaFechamentoCaixaRepository conferencias,
            FormaPagamentoRepository formas, CofreService cofre,
            AberturaCaixaOrigemRepository aberturasOrigem, RecolhimentoCofreRepository registrosCofre,
            ContaFinanceiraRepository contas, PlatformTransactionManager transactionManager) {
        this.aberturaTransacao = new TransactionTemplate(transactionManager);
        this.cofre = cofre;
        this.caixas = caixas;
        this.sessoes = sessoes;
        this.usuarios = usuarios;
        this.operacional = operacional;
        this.conferencias = conferencias;
        this.formas = formas;
        this.aberturasOrigem = aberturasOrigem;
        this.registrosCofre = registrosCofre;
        this.contas = contas;
    }

    public AberturaContextoDTO obterContextoAbertura(Long caixaId, UsuarioAutenticado autenticado) {
        CaixaEntity caixa = caixas.findByIdAndEmpresaId(caixaId, autenticado.empresaId())
                .orElseThrow(this::naoEncontrado);
        var aberta = sessoes.findByCaixaIdAndEmpresaIdAndStatus(caixaId, autenticado.empresaId(), StatusSessaoCaixa.ABERTO);
        boolean sessaoAberta = aberta.isPresent();
        Long sessaoAbertaId = aberta.map(SessaoCaixaEntity::getId).orElse(null);

        AberturaContextoDTO.TrocoAnteriorDTO trocoAnterior = null;
        var anteriorOpt = sessoes.findFirstByCaixaIdAndEmpresaIdAndStatusOrderByDataFechamentoDescIdDesc(
                caixaId, autenticado.empresaId(), StatusSessaoCaixa.FECHADO);
        if (!sessaoAberta && anteriorOpt.isPresent()) {
            var anterior = anteriorOpt.get();
            boolean jaConsumido = aberturasOrigem.existsBySessaoOrigemTrocoId(anterior.getId());
            if (!jaConsumido) {
                var fechamentoOpt = registrosCofre.findBySessaoIdAndTipo(anterior.getId(), "FECHAMENTO");
                if (fechamentoOpt.isPresent() && fechamentoOpt.get().getValorTroco().signum() > 0) {
                    var fechamento = fechamentoOpt.get();
                    trocoAnterior = new AberturaContextoDTO.TrocoAnteriorDTO(
                            anterior.getId(),
                            fechamento.getValorTroco(),
                            anterior.getDataFechamento(),
                            anterior.getUsuarioFechamento() != null ? anterior.getUsuarioFechamento().getNomeUsuario() : null
                    );
                }
            }
        }

        var cofres = contas.findByEmpresaIdAndTipoAndAtivoTrueOrderByNomeAsc(autenticado.empresaId(), TipoContaFinanceira.COFRE)
                .stream().map(c -> new AberturaContextoDTO.CofreOpcaoDTO(c.getId(), c.getNome(), c.getSaldoAtual()))
                .toList();

        boolean podeMovimentarCofre = autenticado.perfil() == PerfilUsuario.ADMIN || autenticado.perfil() == PerfilUsuario.GERENTE;
        BigDecimal saldoSugerido = trocoAnterior != null ? trocoAnterior.valor() : BigDecimal.ZERO;

        return new AberturaContextoDTO(
                caixa.getId(),
                caixa.getDescricao(),
                Boolean.TRUE.equals(caixa.getAtivo()),
                sessaoAberta,
                sessaoAbertaId,
                trocoAnterior,
                cofres,
                saldoSugerido,
                podeMovimentarCofre
        );
    }

    @Transactional(propagation = Propagation.SUPPORTS)
    public SessaoCaixaResponseDTO abrir(Long caixaId, BigDecimal saldoInicial, UsuarioAutenticado autenticado) {
        return abrir(caixaId, new AberturaCaixaDTO(saldoInicial), autenticado);
    }

    @Transactional(propagation = Propagation.SUPPORTS)
    public SessaoCaixaResponseDTO abrir(Long caixaId, AberturaCaixaDTO request, UsuarioAutenticado autenticado) {
        boolean participaDeTransacao = TransactionSynchronizationManager.isActualTransactionActive();
        try {
            return aberturaTransacao.execute(status -> abrirNaTransacao(caixaId, request, autenticado));
        } catch (DataIntegrityViolationException erro) {
            if (participaDeTransacao) throw erro;
            // A tentativa perdedora já sofreu rollback completo, inclusive do débito do cofre.
            return aberturaTransacao.execute(status -> {
                if (request != null && request.chaveRequisicao() != null) {
                    var existente = aberturasOrigem.findByEmpresaIdAndChaveRequisicao(
                            autenticado.empresaId(), request.chaveRequisicao());
                    if (existente.isPresent()) return repetirAbertura(existente.get(), caixaId, request, autenticado);
                }
                throw erro;
            });
        }
    }

    private SessaoCaixaResponseDTO abrirNaTransacao(Long caixaId, AberturaCaixaDTO request, UsuarioAutenticado autenticado) {
        if (request == null || request.saldoInicial() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o saldo inicial.");
        }
        validarSaldo(request.saldoInicial());
        UsuarioEntity usuario = operador(autenticado);

        boolean estruturada = request.chaveRequisicao() != null || request.confirmarTroco() != null
                || request.valorRetiradoCofre() != null || request.contaCofreId() != null
                || request.valorAporteExterno() != null || request.observacaoAporte() != null;
        if (estruturada && request.chaveRequisicao() == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe a chave da operação de abertura.");
        // Ordem compartilhada com fechamento e cofre: usuário → Caixa → sessão → conta.
        CaixaEntity caixa = bloquearCaixa(caixaId, autenticado.empresaId());
        if (request.chaveRequisicao() != null) {
            var existente = aberturasOrigem.findByEmpresaIdAndChaveRequisicao(autenticado.empresaId(), request.chaveRequisicao());
            if (existente.isPresent()) return repetirAbertura(existente.get(), caixaId, request, autenticado);
        }
        if (!Boolean.TRUE.equals(caixa.getAtivo()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Caixa inativo não pode ser aberto.");
        if (sessoes.findByCaixaIdAndEmpresaIdAndStatus(caixaId, autenticado.empresaId(), StatusSessaoCaixa.ABERTO).isPresent())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe uma sessão aberta neste Caixa.");

        var anteriorOpt = sessoes.findFirstByCaixaIdAndEmpresaIdAndStatusOrderByDataFechamentoDescIdDesc(
                caixaId, autenticado.empresaId(), StatusSessaoCaixa.FECHADO);

        BigDecimal valorTrocoHerdado = BigDecimal.ZERO;
        SessaoCaixaEntity sessaoOrigemTroco = null;
        BigDecimal trocoDisponivel = BigDecimal.ZERO;

        if (anteriorOpt.isPresent()) {
            var anterior = anteriorOpt.get();
            boolean jaConsumido = aberturasOrigem.existsBySessaoOrigemTrocoId(anterior.getId());
            if (!jaConsumido) {
                var fechamentoOpt = registrosCofre.findBySessaoIdAndTipo(anterior.getId(), "FECHAMENTO");
                if (fechamentoOpt.isPresent() && fechamentoOpt.get().getValorTroco().signum() > 0) {
                    trocoDisponivel = fechamentoOpt.get().getValorTroco();
                    if (request.saldoInicial().compareTo(trocoDisponivel) < 0) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                String.format(Locale.GERMAN, "Existem R$ %.2f de troco sob custódia deste Caixa. Regularize o excedente antes de abrir com valor menor.", trocoDisponivel));
                    }
                    if (Boolean.TRUE.equals(request.confirmarTroco())) {
                        valorTrocoHerdado = trocoDisponivel;
                        sessaoOrigemTroco = anterior;
                    } else {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                String.format(Locale.GERMAN, "Há R$ %.2f de troco disponível da sessão #%d. Confirme a utilização do troco.", trocoDisponivel, anterior.getId()));
                    }
                }
            }
        }

        if (Boolean.TRUE.equals(request.confirmarTroco()) && sessaoOrigemTroco == null)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "O troco da sessão anterior já foi utilizado ou não está disponível. Atualize o contexto de abertura.");

        BigDecimal valorCofre = request.valorRetiradoCofre() != null ? request.valorRetiradoCofre() : BigDecimal.ZERO;
        validarSaldo(valorCofre);
        if (valorCofre.signum() > 0) {
            if (autenticado.perfil() != PerfilUsuario.ADMIN && autenticado.perfil() != PerfilUsuario.GERENTE) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ação gerencial necessária para retirada do cofre.");
            }
            if (request.contaCofreId() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecione uma conta COFRE.");
            }
        }

        BigDecimal valorAporte = request.valorAporteExterno() != null ? request.valorAporteExterno() : BigDecimal.ZERO;
        validarSaldo(valorAporte);
        if (valorAporte.signum() > 0) {
            if (autenticado.perfil() != PerfilUsuario.ADMIN && autenticado.perfil() != PerfilUsuario.GERENTE) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ação gerencial necessária para aporte externo.");
            }
            if (request.observacaoAporte() == null || request.observacaoAporte().strip().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o motivo do aporte externo.");
            }
            if (request.observacaoAporte().length() > 500) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Observação do aporte excede o tamanho permitido.");
            }
        }

        if (valorCofre.signum() == 0 && request.contaCofreId() != null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o valor a retirar do cofre selecionado.");
        if (valorAporte.signum() == 0 && normalizarAporte(request.observacaoAporte()) != null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o valor do aporte externo.");

        if (estruturada) {
            BigDecimal soma = valorTrocoHerdado.add(valorCofre).add(valorAporte);
            if (soma.compareTo(request.saldoInicial()) != 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "A soma do troco herdado, retirada do cofre e aporte externo deve corresponder exatamente ao saldo inicial.");
            }
        }

        var sessao = sessoes.saveAndFlush(new SessaoCaixaEntity(caixa, usuario, request.saldoInicial()));

        MovimentacaoFinanceiraEntity movFin = null;
        ContaFinanceiraEntity contaCofre = null;
        if (valorCofre.signum() > 0) {
            movFin = cofre.debitarParaAbertura(request.contaCofreId(), valorCofre, sessao.getId(), caixa.getDescricao(), usuario);
            contaCofre = movFin.getContaFinanceira();
        }

        if (request.saldoInicial().signum() > 0) {
            operacional.registrarSaldoInicial(sessao, usuario, request.saldoInicial());
        }

        if (estruturada) {
            UUID chave = request.chaveRequisicao();
            var origem = new AberturaCaixaOrigemEntity(
                    caixa.getEmpresa(),
                    sessao,
                    sessaoOrigemTroco,
                    contaCofre,
                    movFin,
                    usuario,
                    chave,
                    valorTrocoHerdado,
                    valorCofre,
                    valorAporte,
                    normalizarAporte(request.observacaoAporte()),
                    LocalDateTime.now()
            );
            aberturasOrigem.saveAndFlush(origem);
        }

        return SessaoCaixaResponseDTO.from(sessao);
    }

    private String normalizarAporte(String valor) {
        return valor == null || valor.isBlank() ? null : valor.strip();
    }

    private SessaoCaixaResponseDTO repetirAbertura(AberturaCaixaOrigemEntity origem, Long caixaId,
            AberturaCaixaDTO pedido, UsuarioAutenticado autenticado) {
        BigDecimal cofreInformado = pedido.valorRetiradoCofre() == null ? BigDecimal.ZERO : pedido.valorRetiradoCofre();
        BigDecimal aporteInformado = pedido.valorAporteExterno() == null ? BigDecimal.ZERO : pedido.valorAporteExterno();
        if (!origem.getUsuario().getId().equals(autenticado.usuarioId())
                || !origem.getSessao().getCaixa().getId().equals(caixaId)
                || origem.getSessao().getSaldoInicial().compareTo(pedido.saldoInicial()) != 0
                || origem.getValorRetiradoCofre().compareTo(cofreInformado) != 0
                || origem.getValorAporteExterno().compareTo(aporteInformado) != 0
                || (origem.getSessaoOrigemTroco() != null) != Boolean.TRUE.equals(pedido.confirmarTroco())
                || !Objects.equals(origem.getContaCofre() == null ? null : origem.getContaCofre().getId(), pedido.contaCofreId())
                || !Objects.equals(origem.getObservacaoAporte(), normalizarAporte(pedido.observacaoAporte())))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Chave de abertura já utilizada com outros dados ou operador.");
        return SessaoCaixaResponseDTO.from(origem.getSessao());
    }

    public SessaoCaixaResponseDTO consultarAberta(Long caixaId, Long empresaId) {
        caixas.findByIdAndEmpresaId(caixaId, empresaId).orElseThrow(this::naoEncontrado);
        return SessaoCaixaResponseDTO.from(sessoes.findByCaixaIdAndEmpresaIdAndStatus(caixaId, empresaId, StatusSessaoCaixa.ABERTO)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Não há sessão aberta neste Caixa.")));
    }

    @Transactional
    public SessaoCaixaResponseDTO fechar(Long caixaId, Long sessaoId, BigDecimal saldoFinal, UsuarioAutenticado autenticado) {
        return fechar(caixaId, sessaoId, new FechamentoCaixaDTO(saldoFinal), autenticado);
    }

    @Transactional
    public SessaoCaixaResponseDTO fechar(Long caixaId, Long sessaoId, FechamentoCaixaDTO pedido, UsuarioAutenticado autenticado) {
        BigDecimal saldoFinal = pedido.saldoFinal();
        validarSaldo(saldoFinal);
        UsuarioEntity usuario = operador(autenticado);
        bloquearCaixa(caixaId, autenticado.empresaId());
        SessaoCaixaEntity sessao = operacional.bloquear(sessaoId, autenticado.empresaId());
        if (!sessao.getCaixa().getId().equals(caixaId)) throw naoEncontrado();
        if (autenticado.perfil() != PerfilUsuario.ADMIN && autenticado.perfil() != PerfilUsuario.GERENTE
                && !sessao.getUsuarioAbertura().getId().equals(autenticado.usuarioId()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente quem abriu o Caixa pode fechar esta sessão.");
        var modalidade = pedido.conferencia() == null ? ModalidadeConferencia.LEGADA : ModalidadeConferencia.POR_FORMA;
        var informados = validarInformados(pedido.conferencia());
        String observacao = normalizarObservacao(pedido.conferencia());
        if (sessao.getStatus() != StatusSessaoCaixa.ABERTO) {
            var salvas = conferencias.findBySessaoIdAndEmpresaIdOrderByIdAsc(sessaoId, autenticado.empresaId());
            if (sessao.getSaldoFinal().compareTo(saldoFinal) != 0
                    || sessao.getModalidadeConferencia() != modalidade
                    || !Objects.equals(sessao.getObservacaoFechamento(), observacao)
                    || !mesmosInformados(salvas, informados))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Sessão de Caixa já fechada com outros dados.");
            cofre.fechamento(sessao, usuario, pedido.cofre());
            return resposta(sessao, salvas);
        }
        List<ConferenciaFechamentoCaixaEntity> linhas = List.of();
        if (modalidade == ModalidadeConferencia.POR_FORMA) {
            var resumo = operacional.calcular(sessao);
            var esperadas = resumo.totaisPorFormaPagamento().stream()
                    .filter(f -> !f.tipo().equals("DINHEIRO")).toList();
            var ids = new HashSet<>(esperadas.stream().map(ResumoSessaoCaixaDTO.TotalForma::formaPagamentoId).toList());
            if (!ids.equals(informados.keySet()))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Informe exatamente as formas não dinheiro presentes na sessão, sem omissões ou formas extras.");
            linhas = new ArrayList<>();
            linhas.add(new ConferenciaFechamentoCaixaEntity(sessao, null, "Dinheiro físico", TipoFormaPagamento.DINHEIRO,
                    resumo.saldoEsperadoDinheiro(), saldoFinal));
            for (var forma : esperadas) {
                linhas.add(new ConferenciaFechamentoCaixaEntity(sessao, formas.getReferenceById(forma.formaPagamentoId()),
                        forma.descricao(), TipoFormaPagamento.valueOf(forma.tipo()), forma.total(), informados.get(forma.formaPagamentoId())));
            }
            if (observacao == null && linhas.stream().anyMatch(l -> l.getDiferenca().signum() != 0))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Informe uma observação para fechar com divergência.");
        }
        sessao.fechar(usuario, saldoFinal, modalidade, observacao);
        sessoes.saveAndFlush(sessao);
        conferencias.saveAllAndFlush(linhas);
        cofre.fechamento(sessao, usuario, pedido.cofre());
        return resposta(sessao, linhas);
    }

    private Map<Long, BigDecimal> validarInformados(FechamentoCaixaDTO.Conferencia conferencia) {
        Map<Long, BigDecimal> informados = new HashMap<>();
        if (conferencia == null) return informados;
        if (conferencia.formas() == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe a lista de formas conferidas.");
        for (var forma : conferencia.formas()) {
            if (forma == null || forma.formaPagamentoId() == null || forma.formaPagamentoId() <= 0)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe uma forma de pagamento válida.");
            validarSaldo(forma.valorInformado());
            if (informados.putIfAbsent(forma.formaPagamentoId(), forma.valorInformado()) != null)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Forma de pagamento duplicada na conferência.");
        }
        return informados;
    }

    private String normalizarObservacao(FechamentoCaixaDTO.Conferencia conferencia) {
        if (conferencia == null || conferencia.observacao() == null) return null;
        if (conferencia.observacao().length() > 500)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Observação deve ter até 500 caracteres.");
        String observacao = conferencia.observacao().strip();
        return observacao.isBlank() ? null : observacao;
    }

    private boolean mesmosInformados(List<ConferenciaFechamentoCaixaEntity> salvas, Map<Long, BigDecimal> informados) {
        var formasSalvas = salvas.stream().filter(l -> l.getEscopo() == EscopoConferenciaCaixa.FORMA_PAGAMENTO).toList();
        return formasSalvas.size() == informados.size() && formasSalvas.stream().allMatch(l ->
                informados.containsKey(l.getForma().getId())
                        && l.getValorInformado().compareTo(informados.get(l.getForma().getId())) == 0);
    }

    private SessaoCaixaResponseDTO resposta(SessaoCaixaEntity sessao, List<ConferenciaFechamentoCaixaEntity> linhas) {
        return SessaoCaixaResponseDTO.from(sessao, operacional.calcular(sessao),
                linhas.stream().map(ConferenciaFechamentoCaixaDTO::de).toList());
    }

    // A linha do cadastro existe antes da primeira sessão: serializa abertura/fechamento por Caixa.
    private CaixaEntity bloquearCaixa(Long id, Long empresaId) {
        return caixas.buscarComLock(id, empresaId).orElseThrow(this::naoEncontrado);
    }

    private UsuarioEntity operador(UsuarioAutenticado autenticado) {
        UsuarioEntity usuario = usuarios.buscarComLock(autenticado.usuarioId(), autenticado.empresaId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Operador não pertence à empresa."));
        if (!Boolean.TRUE.equals(usuario.getAtivo()) || !Boolean.TRUE.equals(usuario.getEmpresa().getAtivo()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Operador ou empresa inativa.");
        return usuario;
    }

    private void validarSaldo(BigDecimal saldo) {
        if (saldo == null || saldo.signum() < 0 || saldo.scale() > 2 || saldo.precision() - saldo.scale() > 17)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe saldo não negativo com até duas casas decimais.");
    }

    private ResponseStatusException naoEncontrado() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Caixa ou sessão não encontrado.");
    }
}
