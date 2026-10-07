package br.com.novexa.erp.service;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.ConfiguracaoFormaPagamentoEmpresaRepository;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.web.server.ResponseStatusException;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class PagamentoConfiguracaoPixTest {
    @ParameterizedTest @ValueSource(strings = {"ausente", "tenant", "inativa", "tipo", "configInativa", "BANCO", "CARTEIRA_DIGITAL"})
    void validaDestinoAntesDeRegistrarPix(String caso) {
        var repo = mock(ConfiguracaoFormaPagamentoEmpresaRepository.class);
        var service = new PagamentoService(null, null, null, null, repo, null);
        var config = mock(ConfiguracaoFormaPagamentoEmpresaEntity.class);
        when(repo.buscarParaAtualizar(7L, 1L)).thenReturn(Optional.of(config));
        when(config.getTipo()).thenReturn(TipoFormaPagamento.PIX);
        when(config.isAtivo()).thenReturn(!caso.equals("configInativa"));
        if (!caso.equals("ausente")) {
            var destino = mock(ContaFinanceiraEntity.class);
            var empresa = mock(EmpresaEntity.class);
            when(empresa.getId()).thenReturn(caso.equals("tenant") ? 2L : 1L);
            when(destino.getEmpresa()).thenReturn(empresa);
            when(destino.isAtivo()).thenReturn(!caso.equals("inativa"));
            when(destino.getTipo()).thenReturn(caso.equals("tipo") ? TipoContaFinanceira.CAIXA
                    : caso.equals("CARTEIRA_DIGITAL") ? TipoContaFinanceira.CARTEIRA_DIGITAL : TipoContaFinanceira.BANCO);
            when(config.getContaFinanceiraDestino()).thenReturn(destino);
        }
        if (caso.equals("BANCO") || caso.equals("CARTEIRA_DIGITAL"))
            assertThat(service.resolverConfiguracao(7L, 1L, null)).isSameAs(config);
        else assertThatThrownBy(() -> service.resolverConfiguracao(7L, 1L, null))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode().value()).isEqualTo(409));
    }
}
