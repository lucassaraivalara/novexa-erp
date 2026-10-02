package br.com.novexa.erp.config;

import br.com.novexa.erp.security.JwtAuthenticationFilter;
import br.com.novexa.erp.security.SecurityErrorHandler;
import br.com.novexa.erp.service.JwtService;
import br.com.novexa.erp.repository.UsuarioRepository;
import jakarta.servlet.DispatcherType;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, JwtService jwtService, UsuarioRepository usuarios) throws Exception {
        SecurityErrorHandler errorHandler = new SecurityErrorHandler();
        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())
                .logout(logout -> logout.disable())
                .requestCache(cache -> cache.disable())
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint(errorHandler)
                        .accessDeniedHandler(errorHandler))
                .authorizeHttpRequests(auth -> auth
                        // Preserva o status original no despacho interno de erro do servlet.
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers(HttpMethod.POST, "/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/financeiro/formas-pagamento", "/financeiro/formas-pagamento/**").denyAll()
                        .requestMatchers(HttpMethod.PUT, "/financeiro/formas-pagamento", "/financeiro/formas-pagamento/**").denyAll()
                        .requestMatchers("/usuarios", "/usuarios/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/empresas", "/empresas/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/empresas", "/empresas/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/empresas", "/empresas/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/empresas", "/empresas/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/vendas/{id}/cancelar").hasAnyRole("ADMIN", "GERENTE")
                        .requestMatchers(HttpMethod.POST, "/financeiro/pagamentos/{id}/confirmar-recebimento")
                            .hasAnyRole("ADMIN", "GERENTE")
                        .requestMatchers(HttpMethod.POST, "/financeiro/recebiveis/{id}/liquidar")
                            .hasAnyRole("ADMIN", "GERENTE")
                        .requestMatchers(HttpMethod.POST, "/financeiro/caixas/sessoes/{sessaoId}/movimentacoes")
                            .hasAnyRole("ADMIN", "GERENTE")
                        .anyRequest().authenticated())
                // Registrado apenas na cadeia do Spring Security, evitando execução dupla pelo servlet container.
                .addFilterBefore(new JwtAuthenticationFilter(jwtService, errorHandler, usuarios),
                        UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
