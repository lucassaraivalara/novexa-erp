package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class ContaFinanceiraService {
    private final ContaFinanceiraRepository contas;
    private final MovimentacaoFinanceiraRepository movimentos;
    private final EmpresaRepository empresas;
    private final UsuarioRepository usuarios;
    private final ContaBancariaRepository bancarias;
    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public br.com.novexa.erp.dto.PaginaResponseDTO<MovimentacaoFinanceiraResponseDTO> listarMovimentosPagina(Long empresaId, Long contaFinanceiraId, br.com.novexa.erp.entity.TipoMovimentacaoFinanceira tipo, br.com.novexa.erp.entity.OrigemMovimentacaoFinanceira origem, java.time.LocalDate dataInicial, java.time.LocalDate dataFinal, Boolean estornada, int page, int size, String sort) {
        var pageable = br.com.novexa.erp.util.Paginacao.criar(page, size, sort,
                java.util.Set.of("id", "dataMovimento", "tipo", "origem", "valor"), org.springframework.data.domain.Sort.Direction.DESC);
        if (dataInicial != null && dataFinal != null && dataInicial.isAfter(dataFinal))
            throw br.com.novexa.erp.util.Paginacao.invalida("Periodo invalido.");
        if (contaFinanceiraId != null && !contas.existsByIdAndEmpresaId(contaFinanceiraId, empresaId))
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Conta financeira nao encontrada.");
        return br.com.novexa.erp.dto.PaginaResponseDTO.de(movimentos.listarPagina(empresaId, contaFinanceiraId, tipo, origem, dataInicial, dataFinal, estornada, pageable), MovimentacaoFinanceiraResponseDTO::de);
    }


    public ContaFinanceiraService(ContaFinanceiraRepository contas, MovimentacaoFinanceiraRepository movimentos,
            EmpresaRepository empresas, UsuarioRepository usuarios, ContaBancariaRepository bancarias) {
        this.contas = contas;
        this.movimentos = movimentos;
        this.empresas = empresas;
        this.usuarios = usuarios;
        this.bancarias = bancarias;
    }

    public List<ContaFinanceiraResponseDTO> listarContas(Long empresaId) {
        return contas.findByEmpresaIdOrderByNomeAscIdAsc(empresaId).stream().map(ContaFinanceiraResponseDTO::de).toList();
    }

    public PaginaResponseDTO<ContaFinanceiraResponseDTO> listarContasPagina(Long empresaId, String termo,
            Boolean ativo, TipoContaFinanceira tipo, int page, int size, String sort) {
        var pageable = br.com.novexa.erp.util.Paginacao.criar(page, size, sort,
                java.util.Set.of("id", "nome", "tipo", "saldoAtual", "ativo", "dataCriacao"),
                org.springframework.data.domain.Sort.Direction.ASC);
        return PaginaResponseDTO.de(contas.listarPagina(empresaId, opcional(termo), ativo, tipo, pageable),
                ContaFinanceiraResponseDTO::de);
    }

    public List<ContaFinanceiraResumoDTO> resumirContas(Long empresaId) {
        return contas.resumir(empresaId);
    }

    @Transactional
    public ContaFinanceiraResponseDTO criarConta(Long empresaId, Long usuarioId, ContaFinanceiraCriacaoDTO pedido) {
        var empresa = empresas.findById(empresaId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Empresa não encontrada."));
        var bancaria = validarVinculo(null, pedido.tipo(), pedido.contaBancariaId(), empresaId);
        var usuario = buscarUsuario(usuarioId, empresaId);
        var conta = new ContaFinanceiraEntity(empresa, pedido.nome().trim(), pedido.tipo(), pedido.saldoInicial());
        conta.vincularContaBancaria(bancaria);
        conta.marcarSaldoInicialAuditado();
        contas.saveAndFlush(conta);
        // O construtor já define saldoAtual; o movimento registra a origem sem reaplicar o valor.
        if (conta.getSaldoInicial().signum() > 0)
            movimentos.saveAndFlush(new MovimentacaoFinanceiraEntity(conta, TipoMovimentacaoFinanceira.ENTRADA,
                    OrigemMovimentacaoFinanceira.SALDO_INICIAL, "Saldo inicial", conta.getSaldoInicial(),
                    conta.getDataCriacao().toLocalDate(), null, usuario));
        return ContaFinanceiraResponseDTO.de(conta);
    }

    @Transactional
    public ContaFinanceiraResponseDTO editarConta(Long id, Long empresaId, ContaFinanceiraEdicaoDTO pedido) {
        var conta = buscarConta(id, empresaId);
        var bancaria = validarVinculo(conta, pedido.tipo(), pedido.contaBancariaId(), empresaId);
        conta.editar(pedido.nome().trim(), pedido.tipo());
        conta.vincularContaBancaria(bancaria);
        return ContaFinanceiraResponseDTO.de(contas.saveAndFlush(conta));
    }

    @Transactional
    public ContaFinanceiraResponseDTO alterarSituacao(Long id, Long empresaId, ContaFinanceiraSituacaoDTO pedido) {
        var conta = buscarConta(id, empresaId);
        conta.situacao(pedido.ativo());
        return ContaFinanceiraResponseDTO.de(contas.saveAndFlush(conta));
    }

    public List<MovimentacaoFinanceiraResponseDTO> listarMovimentos(Long empresaId, Long contaId) {
        if (contaId != null && !contas.existsByIdAndEmpresaId(contaId, empresaId))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Conta financeira não encontrada.");
        var lista = contaId == null ? movimentos.findByEmpresaIdOrderByDataMovimentoDescIdDesc(empresaId)
                : movimentos.findByEmpresaIdAndContaFinanceiraIdOrderByDataMovimentoDescIdDesc(empresaId, contaId);
        return lista.stream().map(MovimentacaoFinanceiraResponseDTO::de).toList();
    }

    @Transactional
    public MovimentacaoFinanceiraResponseDTO criarMovimento(Long empresaId, Long usuarioId,
            MovimentacaoFinanceiraCriacaoDTO pedido) {
        var conta = buscarConta(pedido.contaFinanceiraId(), empresaId);
        if (!conta.isAtivo())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Conta financeira inativa não aceita movimentações.");
        var diferenca = pedido.tipo() == TipoMovimentacaoFinanceira.ENTRADA
                ? pedido.valor() : pedido.valor().negate();
        validarSaldo(conta.getSaldoAtual().add(diferenca));
        var usuario = buscarUsuario(usuarioId, empresaId);
        conta.aplicar(diferenca);
        var movimento = new MovimentacaoFinanceiraEntity(conta, pedido.tipo(), pedido.descricao().trim(),
                pedido.valor(), pedido.dataMovimento(), opcional(pedido.observacao()), usuario);
        contas.saveAndFlush(conta);
        return MovimentacaoFinanceiraResponseDTO.de(movimentos.saveAndFlush(movimento));
    }

    @Transactional
    public MovimentacaoFinanceiraEntity registrarSaidaContaPagar(Long empresaId, Long usuarioId,
            Long contaFinanceiraId, String descricao, BigDecimal valor, java.time.LocalDate dataPagamento) {
        var conta = buscarConta(contaFinanceiraId, empresaId);
        if (!conta.isAtivo())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Conta financeira inativa não aceita movimentações.");
        validarSaldo(conta.getSaldoAtual().subtract(valor));
        var usuario = buscarUsuario(usuarioId, empresaId);
        conta.aplicar(valor.negate());
        var movimento = new MovimentacaoFinanceiraEntity(conta, TipoMovimentacaoFinanceira.SAIDA,
                OrigemMovimentacaoFinanceira.CONTAS_A_PAGAR, descricao, valor, dataPagamento, null, usuario);
        contas.saveAndFlush(conta);
        return movimentos.saveAndFlush(movimento);
    }

    @Transactional
    public MovimentacaoFinanceiraResponseDTO estornar(Long id, Long empresaId, Long usuarioId,
            MovimentacaoFinanceiraEstornoDTO pedido) {
        return MovimentacaoFinanceiraResponseDTO.de(estornarMovimento(id, empresaId, usuarioId,
                pedido.motivoEstorno().trim(), OrigemMovimentacaoFinanceira.MANUAL));
    }

    @Transactional
    public void estornarSaidaContaPagar(Long id, Long empresaId, Long usuarioId, String motivo) {
        estornarMovimento(id, empresaId, usuarioId, motivo, OrigemMovimentacaoFinanceira.CONTAS_A_PAGAR);
    }

    @Transactional
    public void registrarEntradaContaReceber(ContaReceberEntity receber, Long usuarioId, ContaReceberBaixaDTO pedido) {
        var conta = buscarConta(pedido.contaFinanceiraId(), receber.getEmpresa().getId());
        entityManager.refresh(conta);
        if (!conta.isAtivo())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Conta financeira inativa nao aceita recebimentos.");
        validarSaldo(conta.getSaldoAtual().add(pedido.valor()));
        var usuario = buscarUsuario(usuarioId, receber.getEmpresa().getId());
        conta.aplicar(pedido.valor());
        contas.saveAndFlush(conta);
        movimentos.saveAndFlush(MovimentacaoFinanceiraEntity.daContaReceber(receber, conta, usuario,
                pedido.valor(), pedido.dataRecebimento(), opcional(pedido.observacao()), pedido.chaveRequisicao()));
    }

    @Transactional
    public BigDecimal estornarEntradaContaReceber(Long id, Long empresaId, Long usuarioId, String motivo) {
        return estornarMovimento(id, empresaId, usuarioId, motivo, OrigemMovimentacaoFinanceira.CONTA_RECEBER).getValor();
    }

    private MovimentacaoFinanceiraEntity estornarMovimento(Long id, Long empresaId, Long usuarioId,
            String motivo, OrigemMovimentacaoFinanceira origemEsperada) {
        Long contaId = movimentos.buscarContaId(id, empresaId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Movimentação financeira não encontrada."));
        var conta = buscarConta(contaId, empresaId);
        if (origemEsperada == OrigemMovimentacaoFinanceira.CONTA_RECEBER) entityManager.refresh(conta);
        var movimento = movimentos.buscarParaEstornar(id, empresaId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Movimentação financeira não encontrada."));
        if (movimento.getOrigem() == OrigemMovimentacaoFinanceira.TRANSFERENCIA)
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Estorne a transferência pelo endpoint /financeiro/transferencias/{id}/estornar.");
        if (movimento.getOrigem() != origemEsperada)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Movimentação deve ser estornada pela sua origem.");
        if (movimento.isEstornada())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Movimentação já estornada.");
        var diferenca = movimento.getTipo() == TipoMovimentacaoFinanceira.ENTRADA
                ? movimento.getValor().negate() : movimento.getValor();
        validarSaldo(conta.getSaldoAtual().add(diferenca));
        conta.aplicar(diferenca);
        movimento.estornar(buscarUsuario(usuarioId, empresaId), motivo);
        contas.saveAndFlush(conta);
        return movimentos.saveAndFlush(movimento);
    }

    private ContaBancariaEntity validarVinculo(ContaFinanceiraEntity atual, TipoContaFinanceira tipo,
            Long bancariaId, Long empresaId) {
        if ((tipo == TipoContaFinanceira.CAIXA || tipo == TipoContaFinanceira.ADQUIRENTE)
                && (atual == null || atual.getTipo() != tipo))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tipo legado indisponível para novos usos.");
        if (tipo != TipoContaFinanceira.BANCO) {
            if (bancariaId != null)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Somente Banco pode ter conta bancária vinculada.");
            return null;
        }
        if (bancariaId == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vincule uma conta bancária para salvar uma conta do tipo Banco.");
        var bancaria = bancarias.buscarParaVincular(bancariaId, empresaId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Conta bancária não encontrada."));
        boolean mesmoVinculo = atual != null && atual.getContaBancaria() != null
                && atual.getContaBancaria().getId().equals(bancariaId);
        if (!mesmoVinculo && !bancaria.isAtivo())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Conta bancária inativa não aceita novo vínculo.");
        if (contas.existeVinculoBancario(bancariaId, atual == null ? null : atual.getId()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Conta bancária já vinculada a outra conta financeira.");
        return bancaria;
    }

    private ContaFinanceiraEntity buscarConta(Long id, Long empresaId) {
        return contas.buscarParaAlterar(id, empresaId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Conta financeira não encontrada."));
    }

    private UsuarioEntity buscarUsuario(Long id, Long empresaId) {
        return usuarios.findByIdAndEmpresaId(id, empresaId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuário não encontrado."));
    }

    private void validarSaldo(BigDecimal saldo) {
        if (saldo.signum() < 0)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Saldo insuficiente para esta operação.");
        if (saldo.precision() - saldo.scale() > 17)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Saldo excede o limite permitido.");
    }

    private String opcional(String texto) { return texto == null || texto.isBlank() ? null : texto.trim(); }
}
