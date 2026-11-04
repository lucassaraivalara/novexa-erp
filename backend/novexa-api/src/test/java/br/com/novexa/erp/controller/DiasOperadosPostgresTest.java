package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.*;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Reutiliza fixture/segurança e as 18 regressões comerciais existentes, no PostgreSQL opt-in. */
class DiasOperadosPostgresTest extends AnaliseVendasPostgresTest {
    void sessao(String abertura, String fechamento, EmpresaEntity e, UsuarioEntity u) {
        var caixa = new CaixaEntity(); caixa.setEmpresa(e); caixa.setDescricao("Sintético " + UUID.randomUUID());
        var s = sessoes.saveAndFlush(new SessaoCaixaEntity(caixas.saveAndFlush(caixa), u, BigDecimal.ZERO));
        jdbc.update("UPDATE sessoes_caixa SET data_abertura=? WHERE id=?", Timestamp.valueOf(LocalDateTime.parse(abertura)), s.getId());
        if (fechamento != null) jdbc.update("UPDATE sessoes_caixa SET status='FECHADO',modalidade_conferencia='LEGADA',data_fechamento=?,saldo_final=0,usuario_fechamento_id=? WHERE id=?",
                Timestamp.valueOf(LocalDateTime.parse(fechamento)), u.getId(), s.getId());
    }

    @Test void separaFechadoZeroVendasParcialESessoesDuplicadasSemAlterarKpis() throws Exception {
        sessao("2026-10-18T09:00:00", "2026-10-18T18:00:00", empresa, admin);
        sessao("2026-10-18T19:00:00", "2026-10-18T20:00:00", empresa, admin);
        sessao("2026-10-19T23:00:00", "2026-10-20T00:00:00", empresa, admin);
        sessao("2026-10-20T23:00:00", "2026-10-21T02:00:00", empresa, admin);
        venda(admin,"2026-10-17T10:00:00","100","5",StatusVenda.FATURADA); // sem sessão, continua legítima
        venda(admin,"2026-10-22T10:00:00","1000","0",StatusVenda.FATURADA);
        venda(admin,"2026-10-16T10:00:00","999","0",StatusVenda.CANCELADA);
        consulta("2026-10-16","2026-10-22").andExpect(status().isOk())
            .andExpect(jsonPath("$.atual.faturamento").value(1100)).andExpect(jsonPath("$.atual.quantidadeVendas").value(2))
            .andExpect(jsonPath("$.atual.ticketMedio").value(550)).andExpect(jsonPath("$.atual.descontos").value(5))
            .andExpect(jsonPath("$.operacao.diasPeriodo").value(7)).andExpect(jsonPath("$.operacao.diasOperados").value(6))
            .andExpect(jsonPath("$.operacao.diasConcluidos").value(5)).andExpect(jsonPath("$.operacao.faturamentoMedio").value(183.33))
            .andExpect(jsonPath("$.operacao.melhorDia.data").value("2026-10-17"))
            .andExpect(jsonPath("$.operacao.piorDia.data").value("2026-10-18"))
            .andExpect(jsonPath("$.evolucao[0].operado").value(false)).andExpect(jsonPath("$.evolucao[1].operado").value(true))
            .andExpect(jsonPath("$.evolucao[2].quantidadeVendas").value(0))
            .andExpect(jsonPath("$.evolucao[6].parcial").value(true)).andExpect(jsonPath("$.variacaoMediaDiaria").isEmpty());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM movimentacoes_financeiras",Long.class)).isZero();
    }

    @Test void meiaNoiteExclusivaESessaoAbertaAtravessandoDias() throws Exception {
        sessao("2026-10-18T20:00:00","2026-10-19T00:00:00",empresa,admin);
        sessao("2026-10-20T20:00:00",null,empresa,admin);
        consulta("2026-10-18","2026-10-22").andExpect(jsonPath("$.operacao.diasOperados").value(4))
            .andExpect(jsonPath("$.evolucao[1].operado").value(false)).andExpect(jsonPath("$.evolucao[3].operado").value(true))
            .andExpect(jsonPath("$.operacao.faturamentoMedio").value(0)).andExpect(jsonPath("$.operacao.diasConcluidos").value(3));
        sessao("2026-10-19T00:00:00","2026-10-19T00:00:00",empresa,admin);
        consulta("2026-10-19","2026-10-19").andExpect(jsonPath("$.operacao.diasOperados").value(1));
    }

    @Test void zeroOperadoParticipaEDesempateEhDataMaisAntiga() throws Exception {
        sessao("2026-10-18T09:00:00","2026-10-18T10:00:00",empresa,admin);
        sessao("2026-10-19T09:00:00","2026-10-19T10:00:00",empresa,admin);
        consulta("2026-10-17","2026-10-21").andExpect(jsonPath("$.operacao.melhorDia.data").value("2026-10-18"))
            .andExpect(jsonPath("$.operacao.piorDia.data").value("2026-10-18"))
            .andExpect(jsonPath("$.operacao.faturamentoMedio").value(0));
        consulta("2026-10-19","2026-10-21").andExpect(jsonPath("$.operacaoAnterior.faturamentoMedio").value(0))
            .andExpect(jsonPath("$.variacaoMediaDiaria").isEmpty());
        sessao("2026-10-22T09:00:00",null,empresa,admin);
        consulta("2026-10-22","2026-10-22").andExpect(jsonPath("$.operacao.diasOperados").value(1))
            .andExpect(jsonPath("$.operacao.diasConcluidos").value(0)).andExpect(jsonPath("$.operacao.melhorDia").isEmpty())
            .andExpect(jsonPath("$.operacao.piorDia").isEmpty()).andExpect(jsonPath("$.operacao.parcial").value(true));
    }

    @Test void comparaMediasComMesmaRegraESemPercentualSemBase() throws Exception {
        sessao("2026-10-14T09:00:00","2026-10-14T10:00:00",empresa,admin);
        venda(admin,"2026-10-15T10:00:00","100","0",StatusVenda.FATURADA);
        sessao("2026-10-18T09:00:00","2026-10-18T10:00:00",empresa,admin);
        venda(admin,"2026-10-19T10:00:00","100","0",StatusVenda.FATURADA);
        consulta("2026-10-18","2026-10-21").andExpect(jsonPath("$.operacao.faturamentoMedio").value(50))
            .andExpect(jsonPath("$.operacaoAnterior.faturamentoMedio").value(50)).andExpect(jsonPath("$.variacaoMediaDiaria").value(0));
        consulta("2026-10-01","2026-10-03").andExpect(jsonPath("$.operacao.diasOperados").value(0))
            .andExpect(jsonPath("$.operacao.faturamentoMedio").isEmpty()).andExpect(jsonPath("$.variacaoMediaDiaria").isEmpty());
    }

    @Test void sessoesEVendasDeOutraEmpresaNaoMarcamOperacao() throws Exception {
        var u = usuario(outra,"11144477735",PerfilUsuario.ADMIN);
        sessao("2026-10-16T09:00:00",null,outra,u);
        venda(u,"2026-10-18T10:00:00","999","0",StatusVenda.FATURADA);
        consulta("2026-10-16","2026-10-22").andExpect(jsonPath("$.operacao.diasOperados").value(0))
            .andExpect(jsonPath("$.operacao.melhorDia").isEmpty()).andExpect(jsonPath("$.atual.faturamento").value(0));
    }

    @Test void mediaMonetariaUsaCentavosEMeioParaCima() throws Exception {
        sessao("2026-10-18T09:00:00","2026-10-18T10:00:00",empresa,admin);
        sessao("2026-10-19T09:00:00","2026-10-19T10:00:00",empresa,admin);
        venda(admin,"2026-10-18T10:00:00","0.05","0",StatusVenda.FATURADA);
        sessao("2026-10-16T09:00:00","2026-10-16T10:00:00",empresa,admin);
        sessao("2026-10-17T09:00:00","2026-10-17T10:00:00",empresa,admin);
        venda(admin,"2026-10-16T10:00:00","0.04","0",StatusVenda.FATURADA);
        consulta("2026-10-18","2026-10-19").andExpect(jsonPath("$.operacao.faturamentoMedio").value(0.03))
            .andExpect(jsonPath("$.atual.faturamento").value(0.05))
            .andExpect(jsonPath("$.operacaoAnterior.faturamentoMedio").value(0.02))
            .andExpect(jsonPath("$.variacaoMediaDiaria").value(25));
    }
}
