package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.TipoFormaPagamento;
import jakarta.validation.constraints.*;

public record FormaPagamentoRequestDTO(
        @NotBlank @Size(max = 150) String descricao,
        @NotNull TipoFormaPagamento tipo,
        Boolean ativo) { }
