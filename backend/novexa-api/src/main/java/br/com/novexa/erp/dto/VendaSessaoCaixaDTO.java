package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.FormaPagamento;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Somente os campos usados na timeline; detalhe da venda permanece no endpoint existente. */
public record VendaSessaoCaixaDTO(Long id, LocalDateTime dataHora, BigDecimal total,
        FormaPagamento formaPagamento, String usuarioNome) { }
