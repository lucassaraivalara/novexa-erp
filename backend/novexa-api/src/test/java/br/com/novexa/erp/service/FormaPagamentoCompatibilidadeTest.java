package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.FaturamentoVendaDTO;
import br.com.novexa.erp.dto.VendaRequestDTO;
import br.com.novexa.erp.entity.FormaPagamento;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

class FormaPagamentoCompatibilidadeTest {
    private final UUID chave = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @Test
    void preservaFormatoLegadoUtilizadoNoHashDaVenda() {
        var item = new VendaRequestDTO.Item(7L, new BigDecimal("2"), new BigDecimal("10"));
        var pedido = new VendaRequestDTO(chave, List.of(item), null, BigDecimal.ZERO,
                new BigDecimal("20"), FormaPagamento.PIX, new BigDecimal("20"), null, null);
        assertThat(pedido.toString()).isEqualTo("VendaRequestDTO[chaveRequisicao=11111111-1111-1111-1111-111111111111, "
                + "itens=[Item[produtoId=7, quantidade=2, precoUnitarioEsperado=10]], clienteId=null, desconto=0, "
                + "totalEsperado=20, formaPagamento=PIX, valorRecebido=20, entrega=null, observacoes=null]");
    }

    @Test
    void preservaFormatoLegadoDoFaturamentoEDistingueIdsNovos() {
        var legado = new FaturamentoVendaDTO(chave, new BigDecimal("20"), FormaPagamento.PIX, new BigDecimal("20"));
        assertThat(legado.toString()).isEqualTo("FaturamentoVendaDTO[chaveRequisicao=11111111-1111-1111-1111-111111111111, "
                + "totalEsperado=20, formaPagamento=PIX, valorRecebido=20]");
        var primeira = new FaturamentoVendaDTO(chave, new BigDecimal("20"), null, new BigDecimal("20"), 2L);
        var segunda = new FaturamentoVendaDTO(chave, new BigDecimal("20"), null, new BigDecimal("20"), 7L);
        assertThat(primeira.toString()).isNotEqualTo(segunda.toString()).isNotEqualTo(legado.toString());
    }
}
