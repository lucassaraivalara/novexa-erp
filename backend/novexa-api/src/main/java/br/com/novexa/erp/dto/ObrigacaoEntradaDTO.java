package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.*;
import java.time.LocalDateTime;

public record ObrigacaoEntradaDTO(Long entradaId, OrigemContaPagarEntrada origem, ContaPagarResponseDTO conta,
        Long usuarioVinculoId, LocalDateTime dataVinculo, boolean podeGerar, boolean podeVincular,
        boolean podeDesvincular, boolean podeCancelarEntrada, String motivoBloqueioCancelamento) {
    public static String bloqueio(EntradaMercadoriaEntity entrada) {
        if (entrada.getStatus() != StatusEntradaMercadoria.CONFIRMADA) return "Somente entradas confirmadas podem ser canceladas.";
        var conta = entrada.getContaPagar();
        if (conta == null) return null;
        if (conta.possuiPagamentoEfetivo()) return "A conta possui pagamento efetivo. Trate o pagamento explicitamente em Contas a Pagar antes de cancelar a entrada.";
        if (entrada.getOrigemContaPagar() == OrigemContaPagarEntrada.PREEXISTENTE)
            return "Desvincule a conta preexistente antes de cancelar a entrada. Ela não será cancelada automaticamente.";
        return null;
    }
    public static ObrigacaoEntradaDTO de(EntradaMercadoriaEntity entrada) {
        var conta = entrada.getContaPagar();
        boolean confirmada = entrada.getStatus() == StatusEntradaMercadoria.CONFIRMADA;
        String motivo = bloqueio(entrada);
        return new ObrigacaoEntradaDTO(entrada.getId(), entrada.getOrigemContaPagar(),
                conta == null ? null : ContaPagarResponseDTO.de(conta), entrada.getUsuarioVinculoContaId(),
                entrada.getDataVinculoConta(), confirmada && conta == null, confirmada && conta == null,
                confirmada && conta != null && entrada.getOrigemContaPagar() == OrigemContaPagarEntrada.PREEXISTENTE
                    && !conta.possuiPagamentoEfetivo(), motivo == null, motivo);
    }
}
