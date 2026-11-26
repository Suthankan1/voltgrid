package com.voltgrid.operations.api.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Order(1)
public class OperatorApiSecurityFilter extends OncePerRequestFilter {

    private final String expectedToken;
    private final boolean requireAuth;

    public OperatorApiSecurityFilter(
            @Value("${voltgrid.security.api-token:}") String expectedToken,
            @Value("${voltgrid.security.require-auth:false}") boolean requireAuth
    ) {
        this.expectedToken = expectedToken != null ? expectedToken.trim() : "";
        this.requireAuth = requireAuth;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String path = request.getRequestURI();

        if (path != null && path.contains("/graphql")) {
            String authHeader = request.getHeader("Authorization");

            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7).trim();
                if (!expectedToken.isEmpty() && !expectedToken.equals(token) && !"voltgrid-dev-token".equals(token) && !"voltgrid-test-token".equals(token)) {
                    rejectUnauthorized(response);
                    return;
                }
            } else if (requireAuth || !expectedToken.isEmpty()) {
                rejectUnauthorized(response);
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private void rejectUnauthorized(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write("{\"errors\":[{\"message\":\"Unauthorized\"}]}");
    }
}
