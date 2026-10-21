package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.StatusSessaoCaixa;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record ResumoSessaoCaixaDTO(Long sessaoId, Long caixaId, StatusSessaoCaixa status,
        BigDecimal saldoInicial, BigDecimal totalVendas, List<TotalForma> totaisPorFormaPagamento,
        BigDecimal suprimentos, BigDecimal sangrias, BigDecimal saldoEsperadoDinheiro,
        BigDecimal saldoFinalInformado, BigDecimal diferenca, String descricaoCaixa,
        LocalDateTime dataHoraAbertura, Operador operadorAbertura, List<TotalConfiguracao> totaisPorConfiguracao) {
    public ResumoSessaoCaixaDTO(Long sessaoId,Long caixaId,StatusSessaoCaixa status,BigDecimal saldoInicial,BigDecimal totalVendas,
            List<TotalForma> totaisPorFormaPagamento,BigDecimal suprimentos,BigDecimal sangrias,BigDecimal saldoEsperadoDinheiro,
            BigDecimal saldoFinalInformado,BigDecimal diferenca,String descricaoCaixa,LocalDateTime dataHoraAbertura,Operador operadorAbertura) {
        this(sessaoId,caixaId,status,saldoInicial,totalVendas,totaisPorFormaPagamento,suprimentos,sangrias,saldoEsperadoDinheiro,
                saldoFinalInformado,diferenca,descricaoCaixa,dataHoraAbertura,operadorAbertura,List.of());
    }
    public record TotalConfiguracao(Long configuracaoId,Long formaPagamentoId,String descricao,String tipo,BigDecimal total) { }

    public record TotalForma(Long formaPagamentoId, String descricao, String tipo, BigDecimal total) { }
    public record Operador(Long id, String nome) { }
}
