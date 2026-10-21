package br.com.novexa.erp.dto;
import java.math.BigDecimal;
import java.time.LocalDate;
public record AgendaRecebimentosDTO(LocalDate dataPrevista, Long configuracaoId, String configuracaoNome,
        String tipo, Long contaDestinoId, String contaDestinoNome, long quantidade,
        BigDecimal bruto, BigDecimal taxas, BigDecimal liquido, long semPrevisaoLiquida) { }
