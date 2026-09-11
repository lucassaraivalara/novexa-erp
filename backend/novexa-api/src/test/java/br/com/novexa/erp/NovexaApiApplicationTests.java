package br.com.novexa.erp;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
    "novexa.jwt.secret=01234567890123456789012345678901",
    "novexa.jwt.expiration-ms=900000",
    "spring.flyway.enabled=false"
})
class NovexaApiApplicationTests {

    @Test
    void contextLoads() {
    }

}
