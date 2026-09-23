package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.SessaoCaixaResponseDTO;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.security.UsuarioAutenticado;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class SessaoCaixaService {
    private final CaixaRepository caixas;
    private final SessaoCaixaRepository sessoes;
    private final UsuarioRepository usuarios;
    private final CaixaOperacionalService operacional;

    public SessaoCaixaService(CaixaRepository caixas, SessaoCaixaRepository sessoes, UsuarioRepository usuarios, CaixaOperacionalService operacional) {
        this.caixas = caixas;
        this.sessoes = sessoes;
        this.usuarios = usuarios;
        this.operacional = operacional;
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
        validarSaldo(saldoFinal);
        bloquearCaixa(caixaId, autenticado.empresaId());
        UsuarioEntity usuario = operador(autenticado);
        SessaoCaixaEntity sessao = operacional.bloquear(sessaoId, autenticado.empresaId());
        if (!sessao.getCaixa().getId().equals(caixaId)) throw naoEncontrado();
        if (sessao.getStatus() != StatusSessaoCaixa.ABERTO) {
            if (sessao.getSaldoFinal().compareTo(saldoFinal) == 0)
                return SessaoCaixaResponseDTO.from(sessao, operacional.calcular(sessao));
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Sessão de Caixa já fechada com outro saldo.");
        }
        sessao.fechar(usuario, saldoFinal);
        return SessaoCaixaResponseDTO.from(sessoes.saveAndFlush(sessao), operacional.calcular(sessao));
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
