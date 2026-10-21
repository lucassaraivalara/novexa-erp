package br.com.novexa.erp.time;

import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.TimeZone;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class TempoNovexaTest {
    @Test void relogioOficialIndependeDoFusoDaMaquina() {
        var original = TimeZone.getDefault();
        try {
            TimeZone.setDefault(TimeZone.getTimeZone("Asia/Tokyo"));
            assertThat(TempoNovexa.relogio().getZone()).isEqualTo(ZoneId.of("America/Sao_Paulo"));
            assertThat(TempoNovexa.agora()).isBetween(LocalDateTime.now(TempoNovexa.ZONA).minusSeconds(1),
                    LocalDateTime.now(TempoNovexa.ZONA).plusSeconds(1));
        } finally { TimeZone.setDefault(original); }
    }

    @Test void trocaDeDiaEmBrasiliaNaoSegueMeiaNoiteUtc() {
        try (var tempo = mockStatic(TempoNovexa.class, CALLS_REAL_METHODS)) {
            tempo.when(TempoNovexa::relogio).thenReturn(Clock.fixed(Instant.parse("2026-10-22T02:59:59Z"), ZoneOffset.UTC));
            assertThat(TempoNovexa.hoje()).isEqualTo(LocalDate.of(2026, 10, 21));
            assertThat(TempoNovexa.agora()).isEqualTo(LocalDateTime.of(2026, 10, 21, 23, 59, 59));
            tempo.when(TempoNovexa::relogio).thenReturn(Clock.fixed(Instant.parse("2026-10-22T03:00:00Z"), ZoneOffset.UTC));
            assertThat(TempoNovexa.hoje()).isEqualTo(LocalDate.of(2026, 10, 22));
            assertThat(TempoNovexa.agora()).isEqualTo(LocalDateTime.of(2026, 10, 22, 0, 0));
        }
    }
}
