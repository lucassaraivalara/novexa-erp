package br.com.novexa.erp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
import br.com.novexa.erp.time.TempoNovexa;
import java.util.TimeZone;

@SpringBootApplication
@EnableScheduling
public class NovexaApiApplication {

    public static void main(String[] args) {
        // Também cobre execução pela IDE/JAR e timestamps dos logs de startup.
        TimeZone.setDefault(TimeZone.getTimeZone(TempoNovexa.ZONA));
        SpringApplication.run(NovexaApiApplication.class, args);
        org.slf4j.LoggerFactory.getLogger(NovexaApiApplication.class)
                .info("Horário oficial Novexa: {}; zona JVM: {}", TempoNovexa.ZONA, java.time.ZoneId.systemDefault());
    }

}
