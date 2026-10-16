package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import jakarta.persistence.EntityManager;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;

@Service
@Transactional
public class EntradaContaPagarService {
    private final EntradaMercadoriaRepository entradas;
    private final ContaPagarRepository contas;
    private final ContaPagarService pagar;
    private final EntityManager em;

    public EntradaContaPagarService(EntradaMercadoriaRepository entradas, ContaPagarRepository contas,
            ContaPagarService pagar, EntityManager em) {
        this.entradas = entradas; this.contas = contas; this.pagar = pagar; this.em = em;
    }

    @Transactional(readOnly = true)
    public ObrigacaoEntradaDTO consultar(Long id, Long empresaId) {
        return ObrigacaoEntradaDTO.de(buscar(id, empresaId));
    }

    public ObrigacaoEntradaDTO gerar(Long id, GerarContaPagarEntradaDTO pedido, UsuarioAutenticado usuario) {
        var entrada = bloquear(id, usuario.empresaId(), null);
        String resumo = resumo(pedido);
        if (entrada.getContaPagar() != null) {
            if (entrada.getOrigemContaPagar() == OrigemContaPagarEntrada.GERADA
                    && pedido.chaveRequisicao().equals(entrada.getChaveGeracaoConta())
                    && resumo.equals(entrada.getResumoGeracaoConta())) return ObrigacaoEntradaDTO.de(entrada);
            throw conflito("A entrada já possui uma obrigação. Consulte a conta vinculada.");
        }
        exigirConfirmada(entrada);
        var dados = new ContaPagarRequestDTO(pedido.descricao(), entrada.getNumeroNota(),
                entrada.getFornecedor().getId(), null, entrada.getDataEmissao(), pedido.dataVencimento(), pedido.valor(), null);
        var criada = pagar.criar(usuario.empresaId(), dados);
        var conta = contas.findByIdAndEmpresaId(criada.id(), usuario.empresaId()).orElseThrow(EntradaContaPagarService::naoEncontrada);
        entrada.vincularConta(conta, OrigemContaPagarEntrada.GERADA, usuario.usuarioId(), pedido.chaveRequisicao(), resumo);
        entradas.saveAndFlush(entrada);
        return ObrigacaoEntradaDTO.de(entrada);
    }

    public ObrigacaoEntradaDTO vincular(Long id, Long contaId, UsuarioAutenticado usuario) {
        var entrada = bloquear(id, usuario.empresaId(), contaId);
        exigirConfirmada(entrada);
        if (entrada.getContaPagar() != null) {
            if (entrada.getContaPagar().getId().equals(contaId)
                    && entrada.getOrigemContaPagar() == OrigemContaPagarEntrada.PREEXISTENTE) return ObrigacaoEntradaDTO.de(entrada);
            throw conflito("A entrada já possui uma obrigação.");
        }
        var conta = contas.findByIdAndEmpresaId(contaId, usuario.empresaId()).orElseThrow(EntradaContaPagarService::naoEncontrada);
        if (conta.getStatus() != StatusContaPagar.ABERTA && conta.getStatus() != StatusContaPagar.PAGA)
            throw conflito("Selecione uma conta aberta ou paga.");
        if (conta.getFornecedor() != null && !conta.getFornecedor().getId().equals(entrada.getFornecedor().getId()))
            throw conflito("O fornecedor da conta é diferente do fornecedor da entrada.");
        if (entradas.findByContaPagarIdAndEmpresaId(contaId, usuario.empresaId()).isPresent())
            throw conflito("Esta conta já está vinculada a outra entrada.");
        entrada.vincularConta(conta, OrigemContaPagarEntrada.PREEXISTENTE, usuario.usuarioId(), null, null);
        entradas.saveAndFlush(entrada);
        return ObrigacaoEntradaDTO.de(entrada);
    }

    public ObrigacaoEntradaDTO desvincular(Long id, Long contaId, UsuarioAutenticado usuario) {
        var entrada = bloquear(id, usuario.empresaId(), null);
        if (entrada.getContaPagar() == null) return ObrigacaoEntradaDTO.de(entrada);
        exigirConfirmada(entrada);
        if (!entrada.getContaPagar().getId().equals(contaId)) throw conflito("O vínculo mudou. Atualize a entrada.");
        if (entrada.getOrigemContaPagar() != OrigemContaPagarEntrada.PREEXISTENTE)
            throw conflito("Conta gerada mantém sua origem. Cancele a entrada para cancelar a obrigação aberta.");
        if (entrada.getContaPagar().possuiPagamentoEfetivo())
            throw conflito("Trate explicitamente o pagamento em Contas a Pagar antes de desvincular.");
        entrada.desvincularConta(); entradas.saveAndFlush(entrada);
        return ObrigacaoEntradaDTO.de(entrada);
    }

    // Contas por ID crescente -> Entrada -> produtos. Pagamento/estorno já bloqueiam a Conta a Pagar.
    // A leitura inicial não é autoridade: após a espera, um vínculo diferente exige nova tentativa.
    EntradaMercadoriaEntity bloquear(Long id, Long empresaId, Long contaSolicitada) {
        var inicial = buscar(id, empresaId);
        Long anterior = inicial.getContaPagar() == null ? null : inicial.getContaPagar().getId();
        var ids = new TreeSet<Long>();
        if (anterior != null) ids.add(anterior);
        if (contaSolicitada != null) ids.add(contaSolicitada);
        for (var contaId : ids) {
            var conta = contas.buscarParaAlterar(contaId, empresaId).orElseThrow(EntradaContaPagarService::naoEncontrada);
            em.refresh(conta);
        }
        var entrada = entradas.bloquear(id, empresaId).orElseThrow(EntradaContaPagarService::naoEncontrada);
        em.refresh(entrada);
        Long atual = entrada.getContaPagar() == null ? null : entrada.getContaPagar().getId();
        if (!Objects.equals(anterior, atual)) throw conflito("O vínculo mudou durante a operação. Atualize e tente novamente.");
        return entrada;
    }

    void cancelarObrigacao(EntradaMercadoriaEntity entrada) {
        var motivo = ObrigacaoEntradaDTO.bloqueio(entrada);
        if (motivo != null) throw conflito(motivo);
        var conta = entrada.getContaPagar();
        if (conta != null && conta.getStatus() == StatusContaPagar.ABERTA) {
            conta.cancelar(); contas.saveAndFlush(conta);
        }
    }

    private EntradaMercadoriaEntity buscar(Long id, Long empresaId) {
        return entradas.findByIdAndEmpresaId(id, empresaId).orElseThrow(EntradaContaPagarService::naoEncontrada);
    }
    private static void exigirConfirmada(EntradaMercadoriaEntity entrada) {
        if (entrada.getStatus() != StatusEntradaMercadoria.CONFIRMADA) throw conflito("Somente entradas confirmadas aceitam obrigação financeira.");
    }
    private static String resumo(GerarContaPagarEntradaDTO pedido) {
        var texto = pedido.descricao().trim() + "\n" + pedido.valor().stripTrailingZeros().toPlainString() + "\n" + pedido.dataVencimento();
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(texto.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    private static ResponseStatusException conflito(String mensagem) { return new ResponseStatusException(HttpStatus.CONFLICT, mensagem); }
    private static ResponseStatusException naoEncontrada() { return new ResponseStatusException(HttpStatus.NOT_FOUND, "Entrada ou conta a pagar não encontrada."); }
}
