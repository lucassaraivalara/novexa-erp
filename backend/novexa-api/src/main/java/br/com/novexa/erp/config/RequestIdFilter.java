package br.com.novexa.erp.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerMapping;

import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RequestIdFilter extends OncePerRequestFilter {
    public static final String HEADER = "X-Request-ID";
    private static final Pattern VALID_ID = Pattern.compile("[A-Za-z0-9._-]{1,64}");
    private static final Logger log = LoggerFactory.getLogger(RequestIdFilter.class);

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String supplied = request.getHeader(HEADER);
        String id = supplied != null && VALID_ID.matcher(supplied).matches() ? supplied : UUID.randomUUID().toString();
        String previous = MDC.get("requestId");
        MDC.put("requestId", id);
        response.setHeader(HEADER, id);
        long start = System.nanoTime();
        boolean failed = false;
        try {
            chain.doFilter(request, response);
        } catch (ServletException | IOException | RuntimeException e) {
            failed = true;
            throw e;
        } finally {
            // Use the route template, not URL/query/body/credentials or personal data.
            Object route = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
            log.info("http method={} route={} status={} durationMs={}", request.getMethod(),
                    route == null ? "unmapped" : route, failed ? 500 : response.getStatus(),
                    TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start));
            if (previous == null) MDC.remove("requestId"); else MDC.put("requestId", previous);
        }
    }
}
