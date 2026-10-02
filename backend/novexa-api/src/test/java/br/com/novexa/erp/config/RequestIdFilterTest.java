package br.com.novexa.erp.config;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.servlet.HandlerMapping;

import java.io.IOException;

import static org.assertj.core.api.Assertions.*;

class RequestIdFilterTest {
    @Test void preservaIdValidoERestauraMdcSemLogarDadosDaRequisicao() throws Exception {
        var request = new MockHttpServletRequest("GET", "/usuarios/123");
        request.addHeader("X-Request-ID", "teste-123");
        request.addHeader("Authorization", "Bearer segredo-nao-logar");
        request.setQueryString("cpf=12345678901");
        var response = new MockHttpServletResponse();
        var logger = (Logger) LoggerFactory.getLogger(RequestIdFilter.class);
        var appender = new ListAppender<ILoggingEvent>();
        appender.start(); logger.addAppender(appender);
        MDC.put("requestId", "anterior");
        try {
            new RequestIdFilter().doFilter(request, response, (req, res) -> {
                assertThat(MDC.get("requestId")).isEqualTo("teste-123");
                req.setAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE, "/usuarios/{id}");
                response.setStatus(403);
            });
            assertThat(response.getHeader("X-Request-ID")).isEqualTo("teste-123");
            assertThat(MDC.get("requestId")).isEqualTo("anterior");
            assertThat(appender.list).hasSize(1);
            assertThat(appender.list.getFirst().getFormattedMessage()).contains("route=/usuarios/{id}", "status=403", "durationMs=")
                    .doesNotContain("segredo-nao-logar", "12345678901", "/usuarios/123");
        } finally {
            logger.detachAppender(appender); appender.stop(); MDC.clear();
        }
    }

    @ParameterizedTest @ValueSource(strings = {"", "id com espaco", "linha\r\ninjetada", "nao/valido"})
    void substituiIdInvalidoELimpaMdc(String id) throws Exception {
        var request = new MockHttpServletRequest(); request.addHeader("X-Request-ID", id);
        var response = new MockHttpServletResponse();
        new RequestIdFilter().doFilter(request, response, (req, res) -> { });
        assertThat(response.getHeader("X-Request-ID")).matches("[0-9a-f-]{36}");
        assertThat(MDC.get("requestId")).isNull();
    }

    @Test void falhaNaoRetemMdc() {
        var response = new MockHttpServletResponse();
        assertThatThrownBy(() -> new RequestIdFilter().doFilter(new MockHttpServletRequest(), response,
                (req, res) -> { throw new IOException("falha interna"); })).isInstanceOf(IOException.class);
        assertThat(response.getHeader("X-Request-ID")).isNotBlank();
        assertThat(MDC.get("requestId")).isNull();
    }
}
