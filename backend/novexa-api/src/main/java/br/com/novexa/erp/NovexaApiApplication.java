package br.com.novexa.erp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class NovexaApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(NovexaApiApplication.class, args);
    }

}
