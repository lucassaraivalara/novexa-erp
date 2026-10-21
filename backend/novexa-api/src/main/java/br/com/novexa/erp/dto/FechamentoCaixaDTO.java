package br.com.novexa.erp.dto;

import jakarta.validation.constraints.*;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.util.List;

public record FechamentoCaixaDTO(
        @NotNull @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal saldoFinal,
        @Valid Conferencia conferencia, @Valid EntregaCofreDTO cofre, @Valid ConferenciaMeios conferenciaMeios) {
    public FechamentoCaixaDTO(BigDecimal saldoFinal, Conferencia conferencia,EntregaCofreDTO cofre) { this(saldoFinal,conferencia,cofre,null); }
    public record ConferenciaMeios(@NotNull br.com.novexa.erp.entity.ModoConferenciaFechamento modo,
            @NotNull @Size(max=200) List<@NotNull @Valid Meio> meios,
            @DecimalMin("0.00") @Digits(integer=17,fraction=2) BigDecimal totalInformado,@Size(max=500) String observacao) { }
    public record Meio(@Positive Long configuracaoId,@Positive Long formaPagamentoId,
            @DecimalMin("0.00") @Digits(integer=17,fraction=2) BigDecimal valorInformado) { }
    public FechamentoCaixaDTO(BigDecimal saldoFinal, Conferencia conferencia) { this(saldoFinal, conferencia, null); }
    public FechamentoCaixaDTO(BigDecimal saldoFinal) { this(saldoFinal, null); }

    public record Conferencia(@NotNull List<@NotNull @Valid Forma> formas,
                              @Size(max = 500) String observacao) { }
    public record Forma(@NotNull @Positive Long formaPagamentoId,
                        @NotNull @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal valorInformado) { }
}
