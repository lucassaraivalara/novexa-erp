package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.Locale;

@Service
@Transactional(readOnly = true)
public class ConfiguracaoFormaPagamentoEmpresaService {
    private final ConfiguracaoFormaPagamentoEmpresaRepository configuracoes;
    private final FormaPagamentoRepository formas;
    private final ContaFinanceiraRepository contas;
    private final EmpresaRepository empresas;

    public ConfiguracaoFormaPagamentoEmpresaService(ConfiguracaoFormaPagamentoEmpresaRepository configuracoes,
            FormaPagamentoRepository formas, ContaFinanceiraRepository contas, EmpresaRepository empresas) {
        this.configuracoes = configuracoes; this.formas = formas; this.contas = contas; this.empresas = empresas;
    }
    public List<ConfiguracaoFormaPagamentoEmpresaResponseDTO> listar(Long empresaId, String situacao) {
        Boolean ativo = switch (situacao.toLowerCase(Locale.ROOT)) {
            case "ativas" -> true;
            case "inativas" -> false;
            case "todas" -> null;
            default -> throw erro(HttpStatus.BAD_REQUEST, "Situação inválida: use ativas, inativas ou todas.");
        };
        return configuracoes.listar(empresaId, ativo).stream().map(ConfiguracaoFormaPagamentoEmpresaResponseDTO::de).toList();
    }
    public ConfiguracaoFormaPagamentoEmpresaResponseDTO buscar(Long id, Long empresaId) {
        return ConfiguracaoFormaPagamentoEmpresaResponseDTO.de(configuracoes.findByIdAndEmpresaId(id, empresaId)
                .orElseThrow(this::naoEncontrada));
    }
    @Transactional
    public ConfiguracaoFormaPagamentoEmpresaResponseDTO criar(Long empresaId, ConfiguracaoFormaPagamentoEmpresaRequestDTO p) {
        var empresa = empresas.findById(empresaId).orElseThrow(() -> erro(HttpStatus.NOT_FOUND, "Empresa não encontrada."));
        var forma = formas.buscarParaPagamento(p.formaPagamentoId())
                .orElseThrow(() -> erro(HttpStatus.NOT_FOUND, "Forma de pagamento não encontrada."));
        if (!forma.isAtivo()) throw erro(HttpStatus.CONFLICT, "Forma de pagamento inativa.");
        String nome = nome(empresaId, p.nomeExibicao(), null);
        var destino = destino(empresaId, forma.getTipo(), p.contaFinanceiraDestinoId(), null, true);
        return ConfiguracaoFormaPagamentoEmpresaResponseDTO.de(configuracoes.saveAndFlush(
                new ConfiguracaoFormaPagamentoEmpresaEntity(empresa, forma, nome, p.ativo() == null || p.ativo(), destino)));
    }
    @Transactional
    public ConfiguracaoFormaPagamentoEmpresaResponseDTO atualizar(Long id, Long empresaId, ConfiguracaoFormaPagamentoEmpresaRequestDTO p) {
        var c = configuracoes.buscarParaAtualizar(id, empresaId).orElseThrow(this::naoEncontrada);
        if (!c.getFormaPagamento().getId().equals(p.formaPagamentoId()))
            throw erro(HttpStatus.CONFLICT, "A forma de pagamento não pode ser alterada. Cadastre outra configuração.");
        boolean ativo = p.ativo() == null ? c.isAtivo() : p.ativo();
        var destino = destino(empresaId, c.getTipo(), p.contaFinanceiraDestinoId(), c.getContaFinanceiraDestino(), ativo && !c.isAtivo());
        c.atualizar(nome(empresaId, p.nomeExibicao(), id), ativo, destino);
        return ConfiguracaoFormaPagamentoEmpresaResponseDTO.de(configuracoes.saveAndFlush(c));
    }
    private ContaFinanceiraEntity destino(Long empresaId, TipoFormaPagamento tipo, Long id,
            ContaFinanceiraEntity atual, boolean ativando) {
        if (tipo != TipoFormaPagamento.PIX && tipo != TipoFormaPagamento.TRANSFERENCIA) {
            if (id != null) throw erro(HttpStatus.BAD_REQUEST, "Este tipo não permite conta financeira de destino.");
            return null;
        }
        if (id == null) throw erro(HttpStatus.BAD_REQUEST, "Informe a conta financeira de destino.");
        boolean mesmoDestino = atual != null && atual.getId().equals(id);
        if (mesmoDestino && !ativando) return atual;
        var conta = contas.buscarParaAlterar(id, empresaId)
                .orElseThrow(() -> erro(HttpStatus.NOT_FOUND, "Conta financeira não encontrada."));
        if (!conta.isAtivo()) throw erro(HttpStatus.CONFLICT, "Conta financeira de destino inativa.");
        if (conta.getTipo() != TipoContaFinanceira.BANCO && conta.getTipo() != TipoContaFinanceira.CARTEIRA_DIGITAL)
            throw erro(HttpStatus.BAD_REQUEST, "Destino deve ser Banco ou Carteira digital.");
        return conta;
    }
    private String nome(Long empresaId, String nome, Long id) {
        if (configuracoes.existeNome(empresaId, nome, id))
            throw erro(HttpStatus.CONFLICT, "Já existe uma configuração com este nome.");
        return nome.trim();
    }
    private ResponseStatusException naoEncontrada() { return erro(HttpStatus.NOT_FOUND, "Configuração de forma de pagamento não encontrada."); }
    private ResponseStatusException erro(HttpStatus status, String texto) { return new ResponseStatusException(status, texto); }
}
