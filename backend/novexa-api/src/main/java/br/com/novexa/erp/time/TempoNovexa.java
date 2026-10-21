package br.com.novexa.erp.time;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

/** Horário civil oficial. Instantes técnicos (JWT/durações) permanecem absolutos. */
public final class TempoNovexa {
    public static final ZoneId ZONA = ZoneId.of("America/Sao_Paulo");
    private static final Clock RELOGIO = Clock.system(ZONA);

    private TempoNovexa() { }

    public static Clock relogio() { return RELOGIO; }
    public static LocalDateTime agora() { return LocalDateTime.now(relogio().withZone(ZONA)); }
    public static LocalDate hoje() { return LocalDate.now(relogio().withZone(ZONA)); }
}
