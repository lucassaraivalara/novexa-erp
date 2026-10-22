package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.PerfilUsuario;
import br.com.novexa.erp.repository.MovimentacaoCaixaRepository;
import br.com.novexa.erp.repository.MovimentacaoFinanceiraRepository;
import br.com.novexa.erp.repository.PagamentoRepository;
import br.com.novexa.erp.repository.UsuarioRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.AutowireCapableBeanFactory;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tarefa 9: ações gerenciais de dinheiro exigem ADMIN/GERENTE.
 * Receber conta a receber permanece liberado para perfil operacional.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:autorizacao;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false",
        "spring.jpa.open-in-view=false", "spring.jpa.show-sql=false",
        "novexa.jwt.secret=01234567890123456789012345678901", "novexa.jwt.expiration-ms=60000"
})
@AutoConfigureMockMvc
class AutorizacaoGerencialHttpTest {
    @Autowired AutowireCapableBeanFactory beans;
    @Autowired UsuarioRepository usuarios;
    @MockitoSpyBean PagamentoRepository pagamentos;
    @MockitoSpyBean MovimentacaoFinanceiraRepository movimentosFinanceiros;
    @MockitoSpyBean MovimentacaoCaixaRepository movimentosCaixa;
    VendaHttpTest fluxo;

    @BeforeEach void preparar() {
        fluxo = new VendaHttpTest();
        beans.autowireBean(fluxo);
        fluxo.pagamentos = pagamentos;
        fluxo.movimentosFinanceiros = movimentosFinanceiros;
        fluxo.movimentosCaixa = movimentosCaixa;
        fluxo.preparar();
    }

    @AfterEach void limpar() { fluxo.limpar(); }

    private String tokenPerfil(String perfil) {
        fluxo.segundo.setPerfil(PerfilUsuario.valueOf(perfil));
        fluxo.segundo = usuarios.saveAndFlush(fluxo.segundo);
        return "Bearer " + fluxo.jwt.gerarToken(fluxo.segundo);
    }

    @ParameterizedTest
    @ValueSource(strings = {"ADMIN", "GERENTE", "OPERADOR", "USUARIO"})
    void estornosCancelamentoTransferenciaECadastroDeCaixaExigemPerfilGerencial(String perfil) throws Exception {
        String token = tokenPerfil(perfil);
        boolean gerencial = perfil.equals("ADMIN") || perfil.equals("GERENTE");

        fluxo.mvc.perform(post("/financeiro/contas-receber/999999/cancelar").header("Authorization", token))
                .andExpect(gerencial ? status().isNotFound() : status().isForbidden());
        fluxo.mvc.perform(post("/financeiro/contas-receber/999999/recebimentos/1/estornar")
                        .header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"motivoEstorno\":\"ajuste de teste\"}"))
                .andExpect(gerencial ? status().isNotFound() : status().isForbidden());
        fluxo.mvc.perform(patch("/financeiro/movimentacoes-financeiras/1/estorno")
                        .header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"motivoEstorno\":\"ajuste de teste\"}"))
                .andExpect(gerencial ? status().isNotFound() : status().isForbidden());
        fluxo.mvc.perform(post("/financeiro/contas-pagar/999999/estornar").header("Authorization", token))
                .andExpect(gerencial ? status().isNotFound() : status().isForbidden());
        fluxo.mvc.perform(post("/financeiro/transferencias").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(gerencial ? status().isBadRequest() : status().isForbidden());
        fluxo.mvc.perform(post("/financeiro/transferencias/999999/estornar")
                        .header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"motivoEstorno\":\"ajuste de teste\"}"))
                .andExpect(gerencial ? status().isNotFound() : status().isForbidden());
        fluxo.mvc.perform(put("/financeiro/caixas/999999").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(gerencial ? status().is4xxClientError() : status().isForbidden());
        fluxo.mvc.perform(delete("/financeiro/caixas/999999").header("Authorization", token))
                .andExpect(gerencial ? status().is4xxClientError() : status().isForbidden());
    }

    @ParameterizedTest
    @ValueSource(strings = {"ADMIN", "GERENTE", "OPERADOR", "USUARIO"})
    void receberContaPermaneceLiberadoParaQualquerPerfilAutenticado(String perfil) throws Exception {
        String token = tokenPerfil(perfil);
        int status = fluxo.mvc.perform(post("/financeiro/contas-receber/999999/receber").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andReturn().getResponse().getStatus();
        assertThat(status).isNotEqualTo(403);
    }
}
