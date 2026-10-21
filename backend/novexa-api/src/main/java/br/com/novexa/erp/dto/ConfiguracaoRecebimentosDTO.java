package br.com.novexa.erp.dto;
import br.com.novexa.erp.entity.*;
import jakarta.validation.constraints.NotNull;
public record ConfiguracaoRecebimentosDTO(@NotNull ModoRecebimentoFinanceiro modo,
        ModoConferenciaFechamento conferencia, Boolean exigirValoresInformadosNoFechamento) {
    public static ConfiguracaoRecebimentosDTO de(EmpresaEntity e) {
        return new ConfiguracaoRecebimentosDTO(e.getModoRecebimentoFinanceiro(), e.getModoConferenciaFechamento(), e.isExigirValoresInformadosNoFechamento());
    }
}
