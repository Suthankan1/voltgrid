package com.voltgrid.station.api.security;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class JwtTokenValidatorTests {

    private static final String TEST_SECRET = "secure_voltgrid_jwt_signing_secret_key_2026_32bytes!!";
    private static final String ROGUE_SECRET = "wrong_secret_key_that_does_not_match_at_all_32bytes!!";
    private static final String ISSUER = "https://auth.voltgrid.lk/realms/voltgrid";
    private static final String AUDIENCE = "voltgrid-api";

    private JwtTokenValidator validator;

    @BeforeEach
    void setUp() {
        validator = new JwtTokenValidator(ISSUER, AUDIENCE,
                org.springframework.security.oauth2.jwt.NimbusJwtDecoder.withSecretKey(
                        new javax.crypto.spec.SecretKeySpec(TEST_SECRET.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                                "HmacSHA256")).build());
    }

    private String createSignedJwt(String sub, String email, String iss, String aud, Instant exp, String secret, String orgId) throws Exception {
        JWTClaimsSet.Builder builder = new JWTClaimsSet.Builder()
                .subject(sub)
                .claim("email", email)
                .claim("typ", "Bearer")
                .issuer(iss)
                .audience(aud)
                .claim("roles", List.of("OPERATOR", "ORG_ADMIN"))
                .expirationTime(Date.from(exp))
                .issueTime(new Date());

        if (orgId != null) {
            builder.claim("org_id", orgId);
        }

        JWTClaimsSet claimsSet = builder.build();
        SignedJWT signedJWT = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claimsSet);
        signedJWT.sign(new MACSigner(secret.getBytes(StandardCharsets.UTF_8)));
        return signedJWT.serialize();
    }

    @Test
    void shouldAcceptValidTokenWithMatchingIssuerAndAudience() throws Exception {
        Instant futureExp = Instant.now().plusSeconds(3600);
        String token = createSignedJwt(
                "user-123",
                "operator@voltgrid.lk",
                ISSUER,
                AUDIENCE,
                futureExp,
                TEST_SECRET,
                "org-ceylon-01"
        );

        var result = validator.validateAndExtract(token, "org-ceylon-01");

        assertThat(result).isPresent();
        var user = result.get();
        assertThat(user.userId()).isEqualTo("user-123");
        assertThat(user.email()).isEqualTo("operator@voltgrid.lk");
        assertThat(user.roles()).contains("OPERATOR", "ORG_ADMIN");
        assertThat(user.activeOrganizationId()).isEqualTo("org-ceylon-01");
    }

    @Test
    void shouldRejectTokenSignedWithWrongKey() throws Exception {
        Instant futureExp = Instant.now().plusSeconds(3600);
        String token = createSignedJwt(
                "user-123",
                "operator@voltgrid.lk",
                ISSUER,
                AUDIENCE,
                futureExp,
                ROGUE_SECRET,
                "org-ceylon-01"
        );

        var result = validator.validateAndExtract(token, "org-ceylon-01");

        assertThat(result).isEmpty();
    }

    @Test
    void shouldRejectExpiredToken() throws Exception {
        Instant pastExp = Instant.now().minusSeconds(3600);
        String token = createSignedJwt(
                "user-123",
                "operator@voltgrid.lk",
                ISSUER,
                AUDIENCE,
                pastExp,
                TEST_SECRET,
                "org-ceylon-01"
        );

        var result = validator.validateAndExtract(token, "org-ceylon-01");

        assertThat(result).isEmpty();
    }

    @Test
    void shouldRejectTokenWithWrongIssuer() throws Exception {
        Instant futureExp = Instant.now().plusSeconds(3600);
        String token = createSignedJwt(
                "user-123",
                "operator@voltgrid.lk",
                "https://rogue-issuer.com",
                AUDIENCE,
                futureExp,
                TEST_SECRET,
                "org-ceylon-01"
        );

        var result = validator.validateAndExtract(token, "org-ceylon-01");

        assertThat(result).isEmpty();
    }

    @Test
    void shouldRejectTokenWithWrongAudience() throws Exception {
        Instant futureExp = Instant.now().plusSeconds(3600);
        String token = createSignedJwt(
                "user-123",
                "operator@voltgrid.lk",
                ISSUER,
                "other-api",
                futureExp,
                TEST_SECRET,
                "org-ceylon-01"
        );

        var result = validator.validateAndExtract(token, "org-ceylon-01");

        assertThat(result).isEmpty();
    }

    @Test
    void shouldRejectMalformedToken() {
        assertThat(validator.validateAndExtract("not-a-jwt", "org-1")).isEmpty();
        assertThat(validator.validateAndExtract("header.invalid-base64.sig", "org-1")).isEmpty();
        assertThat(validator.validateAndExtract("", "org-1")).isEmpty();
        assertThat(validator.validateAndExtract(null, "org-1")).isEmpty();
    }

    @Test
    void shouldRejectStaticDevBypassToken() {
        // IAM-001 negative test: static bypass token must never be accepted
        var result = validator.validateAndExtract("voltgrid-dev-token", "org-test");
        assertThat(result).isEmpty();
    }
}
