package com.voltgrid.station.api.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Order(1)
public class OperatorApiSecurityFilter extends OncePerRequestFilter {

    private final boolean requireAuth;
    private final JwtTokenValidator tokenValidator;

    @Autowired
    public OperatorApiSecurityFilter(
            @Value("${voltgrid.security.require-auth:true}") boolean requireAuth,
            JwtTokenValidator tokenValidator
    ) {
        this.requireAuth = requireAuth;
        this.tokenValidator = tokenValidator;
    }

    public OperatorApiSecurityFilter(JwtTokenValidator tokenValidator) {
        this(true, tokenValidator);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String path = request.getRequestURI();

        if (path != null && (path.startsWith("/graphql") || path.startsWith("/api/"))) {
            String authHeader = request.getHeader("Authorization");
            String requestedOrg = request.getHeader("X-Tenant-Id");

            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                if (requireAuth) {
                    rejectUnauthorized(response, "MISSING_BEARER_TOKEN", "Authentication required: missing Bearer token");
                    return;
                }
            } else {
                String token = authHeader.substring(7).trim();
                var userOpt = tokenValidator.validateAndExtract(token, requestedOrg);

                if (userOpt.isPresent()) {
                    SecurityContext.set(userOpt.get());
                } else if (requireAuth) {
                    rejectUnauthorized(response, "INVALID_BEARER_TOKEN", "Invalid or expired Bearer token");
                    return;
                }
            }
        }

        try {
            filterChain.doFilter(request, response);
        } finally {
            SecurityContext.clear();
        }
    }

    private void rejectUnauthorized(HttpServletResponse response, String code, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write(String.format(
                "{\"errors\":[{\"message\":\"%s\",\"extensions\":{\"code\":\"UNAUTHORIZED\",\"reason\":\"%s\"}}]}",
                message, code
        ));
    }
}
