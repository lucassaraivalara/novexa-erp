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
import java.util.*;

@Service
@Transactional(readOnly = true)
public class SessaoCaixaService {
    private final CaixaRepository caixas;
    private final SessaoCaixaRepository sessoes;
    private final UsuarioRepository usuarios;
    private final CaixaOperacionalService operacional;
    private final ConferenciaFechamentoCaixaRepository conferencias;
    private final FormaPagamentoRepository formas;

    public SessaoCaixaService(CaixaRepository caixas, SessaoCaixaRepository sessoes, UsuarioRepository usuarios,
            CaixaOperacionalService operacional, ConferenciaFechamentoCaixaRepository conferencias,
            FormaPagamentoRepository formas) {
        this.caixas = caixas;
        this.sessoes = sessoes;
        this.usuarios = usuarios;
        this.operacional = operacional;
        this.conferencias = conferencias;
        this.formas = formas;
    }

    @Transactional
    public SessaoCaixaResponseDTO abrir(Long caixaId, BigDecimal saldoInicial, UsuarioAutenticado autenticado) {
        validarSaldo(saldoInicial);
        CaixaEntity caixa = bloquearCaixa(caixaId, autenticado.empresaId());
        UsuarioEntity usuario = operador(autenticado);
        if (!Boolean.TRUE.equals(caixa.getAtivo()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Caixa inativo não pode ser aberto.");
        if (sessoes.findByCaixaIdAndEmpresaIdAndStatus(caixaId, autenticado.empresaId(), StatusSessaoCaixa.ABERTO).isPresent())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe uma sessão aberta neste Caixa.");
        var sessao = sessoes.saveAndFlush(new SessaoCaixaEntity(caixa, usuario, saldoInicial));
        if (saldoInicial.signum() > 0) {
            operacional.registrarSaldoInicial(sessao, usuario, saldoInicial);
        }
        return SessaoCaixaResponseDTO.from(sessao);
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
        bloquearCaixa(caixaId, autenticado.empresaId());
        UsuarioEntity usuario = operador(autenticado);
        SessaoCaixaEntity sessao = operacional.bloquear(sessaoId, autenticado.empresaId());
        if (!sessao.getCaixa().getId().equals(caixaId)) throw naoEncontrado();
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
        UsuarioEntity usuario = usuarios.findByIdAndEmpresaId(autenticado.usuarioId(), autenticado.empresaId())
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
