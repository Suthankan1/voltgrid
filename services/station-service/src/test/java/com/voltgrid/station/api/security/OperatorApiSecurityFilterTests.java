package com.voltgrid.station.api.security;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OperatorApiSecurityFilterTests {

    private static final String TEST_SECRET = "secure_voltgrid_jwt_signing_secret_key_2026_32bytes!!";
    private static final String ISSUER = "https://auth.voltgrid.lk/realms/voltgrid";
    private static final String AUDIENCE = "voltgrid-api";

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    @Mock
    private FilterChain filterChain;

    private JwtTokenValidator tokenValidator;
    private OperatorApiSecurityFilter filter;

    @BeforeEach
    void setUp() {
        tokenValidator = new JwtTokenValidator(ISSUER, AUDIENCE,
                org.springframework.security.oauth2.jwt.NimbusJwtDecoder.withSecretKey(
                        new javax.crypto.spec.SecretKeySpec(TEST_SECRET.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                                "HmacSHA256")).build());
        filter = new OperatorApiSecurityFilter(true, tokenValidator);
    }

    private String createSignedJwt(String sub, String email, Instant exp) throws Exception {
        JWTClaimsSet claimsSet = new JWTClaimsSet.Builder()
                .subject(sub)
                .claim("email", email)
                .claim("typ", "Bearer")
                .issuer(ISSUER)
                .audience(AUDIENCE)
                .claim("roles", List.of("OPERATOR"))
                .claim("org_id", "org-ceylon-01")
                .expirationTime(Date.from(exp))
                .issueTime(new Date())
                .build();

        SignedJWT signedJWT = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claimsSet);
        signedJWT.sign(new MACSigner(TEST_SECRET.getBytes(StandardCharsets.UTF_8)));
        return signedJWT.serialize();
    }

    @Test
    void shouldPermitWhenValidBearerTokenProvided() throws Exception {
        String token = createSignedJwt("user-123", "operator@voltgrid.lk", Instant.now().plusSeconds(3600));

        when(request.getRequestURI()).thenReturn("/graphql");
        when(request.getHeader("Authorization")).thenReturn("Bearer " + token);
        when(request.getHeader("X-Tenant-Id")).thenReturn("org-ceylon-01");

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        verify(response, never()).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        // SecurityContext should be cleared after filter completion
        assertThat(SecurityContext.get()).isNull();
    }

    @Test
    void shouldRejectWhenMissingBearerToken() throws Exception {
        var stringWriter = new StringWriter();
        when(request.getRequestURI()).thenReturn("/graphql");
        when(request.getHeader("Authorization")).thenReturn(null);
        when(response.getWriter()).thenReturn(new PrintWriter(stringWriter));

        filter.doFilterInternal(request, response, filterChain);

        verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        verify(filterChain, never()).doFilter(request, response);
        assertThat(stringWriter.toString()).contains("MISSING_BEARER_TOKEN");
    }

    @Test
    void shouldRejectWhenInvalidBearerTokenProvided() throws Exception {
        var stringWriter = new StringWriter();
        when(request.getRequestURI()).thenReturn("/graphql");
        when(request.getHeader("Authorization")).thenReturn("Bearer invalid.crypto.signature");
        when(request.getHeader("X-Tenant-Id")).thenReturn("org-ceylon-01");
        when(response.getWriter()).thenReturn(new PrintWriter(stringWriter));

        filter.doFilterInternal(request, response, filterChain);

        verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        verify(filterChain, never()).doFilter(request, response);
        assertThat(stringWriter.toString()).contains("INVALID_BEARER_TOKEN");
    }

    @Test
    void shouldPermitNonSecuredEndpointsWithoutAuth() throws Exception {
        when(request.getRequestURI()).thenReturn("/actuator/health");

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        verify(response, never()).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    }
}
