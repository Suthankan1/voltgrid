package com.voltgrid.station.api.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;

class JwtTokenValidatorTests {

    private JwtTokenValidator validator;

    @BeforeEach
    void setUp() {
        validator = new JwtTokenValidator("https://auth.voltgrid.lk/realms/voltgrid", "voltgrid-api", true);
    }

    private String createTestJwt(String sub, String email, String iss, String aud, long expSeconds) {
        String header = Base64.getUrlEncoder().withoutPadding()
                .encodeToString("{\"alg\":\"RS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
        String payloadJson = String.format(
                "{\"sub\":\"%s\",\"email\":\"%s\",\"iss\":\"%s\",\"aud\":\"%s\",\"exp\":%d,\"roles\":[\"OPERATOR\",\"ORG_ADMIN\"]}",
                sub, email, iss, aud, expSeconds
        );
        String payload = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(payloadJson.getBytes(StandardCharsets.UTF_8));
        String signature = Base64.getUrlEncoder().withoutPadding()
                .encodeToString("mock-crypto-signature".getBytes(StandardCharsets.UTF_8));
        return header + "." + payload + "." + signature;
    }

    @Test
    void shouldAcceptValidTokenWithMatchingIssuerAndAudience() {
        long futureExp = Instant.now().getEpochSecond() + 3600;
        String token = createTestJwt(
                "user-123",
                "operator@voltgrid.lk",
                "https://auth.voltgrid.lk/realms/voltgrid",
                "voltgrid-api",
                futureExp
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
    void shouldRejectExpiredToken() {
        long pastExp = Instant.now().getEpochSecond() - 3600;
        String token = createTestJwt(
                "user-123",
                "operator@voltgrid.lk",
                "https://auth.voltgrid.lk/realms/voltgrid",
                "voltgrid-api",
                pastExp
        );

        var result = validator.validateAndExtract(token, "org-ceylon-01");

        assertThat(result).isEmpty();
    }

    @Test
    void shouldRejectTokenWithWrongIssuer() {
        long futureExp = Instant.now().getEpochSecond() + 3600;
        String token = createTestJwt(
                "user-123",
                "operator@voltgrid.lk",
                "https://rogue-issuer.com",
                "voltgrid-api",
                futureExp
        );

        var result = validator.validateAndExtract(token, "org-ceylon-01");

        assertThat(result).isEmpty();
    }

    @Test
    void shouldRejectTokenWithWrongAudience() {
        long futureExp = Instant.now().getEpochSecond() + 3600;
        String token = createTestJwt(
                "user-123",
                "operator@voltgrid.lk",
                "https://auth.voltgrid.lk/realms/voltgrid",
                "other-api",
                futureExp
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
    void shouldAcceptLocalDevTestTokens() {
        var devValidator = new JwtTokenValidator("", "voltgrid-api", false);
        var devUser = devValidator.validateAndExtract("voltgrid-dev-token", "org-test");
        assertThat(devUser).isPresent();
        assertThat(devUser.get().userId()).isEqualTo("sub_admin_001");
        assertThat(devUser.get().roles()).contains("ORG_OWNER", "PLATFORM_ADMIN");
    }
}
