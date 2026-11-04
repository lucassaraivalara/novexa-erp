package br.com.novexa.erp.dto;

import br.com.novexa.erp.entity.PagamentoContaPagarEntity;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record PagamentoContaPagarResponseDTO(Long id, Long contaPagarId, UUID chaveRequisicao,
        LocalDate dataPagamento, BigDecimal valorOriginal, BigDecimal principalQuitado,
        BigDecimal juros, BigDecimal multa, BigDecimal desconto, BigDecimal totalPago, String estado,
        Long usuarioId, String usuarioNome, LocalDateTime dataCriacao, Long usuarioEstornoId,
        String usuarioEstornoNome, LocalDateTime dataEstorno, String motivoEstorno,
        List<OrigemPagamentoContaPagarDTO> origens) {
    public static PagamentoContaPagarResponseDTO de(PagamentoContaPagarEntity p,List<OrigemPagamentoContaPagarDTO> origens) {
        var u=p.getUsuarioEstorno();
        return new PagamentoContaPagarResponseDTO(p.getId(),p.getContaPagar().getId(),p.getChaveRequisicao(),
            p.getDataPagamento(),p.getValorOriginal(),p.getPrincipalQuitado(),p.getJuros(),p.getMulta(),p.getDesconto(),
            p.getTotalPago(),p.getEstado(),p.getUsuario().getId(),p.getUsuario().getNomeUsuario(),p.getDataCriacao(),
            u==null?null:u.getId(),u==null?null:u.getNomeUsuario(),p.getDataEstorno(),p.getMotivoEstorno(),origens);
    }
}
