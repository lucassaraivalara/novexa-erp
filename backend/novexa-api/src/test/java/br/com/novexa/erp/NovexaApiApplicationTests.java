package br.com.novexa.erp;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = "novexa.jwt.secret=01234567890123456789012345678901")
class NovexaApiApplicationTests {

    @Test
    void contextLoads() {
    }

}
