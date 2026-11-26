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

    private final String expectedToken;
    private final boolean requireAuth;
    private final JwtTokenValidator tokenValidator;

    @Autowired
    public OperatorApiSecurityFilter(
            @Value("${voltgrid.security.api-token:}") String expectedToken,
            @Value("${voltgrid.security.require-auth:false}") boolean requireAuth,
            JwtTokenValidator tokenValidator
    ) {
        this.expectedToken = expectedToken != null ? expectedToken.trim() : "";
        this.requireAuth = requireAuth;
        this.tokenValidator = tokenValidator;
    }

    public OperatorApiSecurityFilter(String expectedToken) {
        this(expectedToken, false, new JwtTokenValidator("", "voltgrid-api", false));
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String path = request.getRequestURI();

        if (path != null && path.startsWith("/graphql")) {
            String authHeader = request.getHeader("Authorization");
            String requestedOrg = request.getHeader("X-Tenant-Id");

            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7).trim();

                if (!expectedToken.isEmpty() && expectedToken.equals(token)) {
                    var user = tokenValidator.validateAndExtract("voltgrid-dev-token", requestedOrg);
                    user.ifPresent(SecurityContext::set);
                } else {
                    var userOpt = tokenValidator.validateAndExtract(token, requestedOrg);
                    if (userOpt.isPresent()) {
                        SecurityContext.set(userOpt.get());
                    } else if (requireAuth || !expectedToken.isEmpty()) {
                        rejectUnauthorized(response);
                        return;
                    }
                }
            } else if (requireAuth || !expectedToken.isEmpty()) {
                rejectUnauthorized(response);
                return;
            }
        }

        try {
            filterChain.doFilter(request, response);
        } finally {
            SecurityContext.clear();
        }
    }

    private void rejectUnauthorized(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write("{\"errors\":[{\"message\":\"Unauthorized\"}]}");
    }
}
