package com.voltgrid.operations.api.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import java.time.Duration;

import java.io.IOException;

@Component
@Order(1)
public class OperatorApiSecurityFilter extends OncePerRequestFilter {

    private final boolean requireAuth;
    private final JwtTokenValidator tokenValidator;
    private final RestClient stationAccess;

    @Autowired
    public OperatorApiSecurityFilter(
            @Value("${voltgrid.security.require-auth:true}") boolean requireAuth,
            JwtTokenValidator tokenValidator,
            @Value("${voltgrid.station-access-base-url:http://localhost:8081}") String stationAccessUrl
    ) {
        this.requireAuth = requireAuth;
        this.tokenValidator = tokenValidator;
        var requests = new SimpleClientHttpRequestFactory();
        requests.setConnectTimeout(Duration.ofSeconds(2));
        requests.setReadTimeout(Duration.ofSeconds(2));
        this.stationAccess = RestClient.builder().baseUrl(stationAccessUrl).requestFactory(requests).build();
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String path = request.getRequestURI();

        if (path != null && (path.contains("/graphql") || path.startsWith("/api/"))) {
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
                    var user = userOpt.get();
                    if (!hasOrganizationAccess(token, user.activeOrganizationId())) {
                        response.sendError(HttpServletResponse.SC_FORBIDDEN);
                        return;
                    }
                    SecurityContext.set(user);
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

    private boolean hasOrganizationAccess(String token, String organization) {
        try {
            return stationAccess.get()
                    .uri(builder -> builder.path("/api/operator/organization-access")
                            .queryParam("organizationId", "{organization}")
                            .build(organization))
                    .headers(headers -> headers.setBearerAuth(token))
                    .retrieve().toBodilessEntity().getStatusCode().is2xxSuccessful();
        } catch (RestClientException unavailableOrDenied) {
            return false;
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
