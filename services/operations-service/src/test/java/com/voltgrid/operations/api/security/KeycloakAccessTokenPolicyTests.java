package com.voltgrid.operations.api.security;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class KeycloakAccessTokenPolicyTests {

    private static final String ISSUER = "https://id.example.test/realms/voltgrid";
    private static final String AUDIENCE = "voltgrid-api";
    private final AtomicReference<RSAKey> publishedKey = new AtomicReference<>();
    private final AtomicBoolean jwksAvailable = new AtomicBoolean(true);
    private RSAKey initialKey;
    private HttpServer jwksServer;
    private JwtTokenValidator validator;

    @BeforeEach
    void configureValidator() throws Exception {
        initialKey = new RSAKeyGenerator(2048).keyID("initial").generate();
        publishedKey.set(initialKey.toPublicJWK());
        jwksServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        jwksServer.createContext("/jwks", exchange -> {
            try (exchange) {
                if (!jwksAvailable.get()) {
                    exchange.sendResponseHeaders(503, -1);
                    return;
                }
                byte[] body = new JWKSet(publishedKey.get()).toString().getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
            }
        });
        jwksServer.start();
        String jwksUri = "http://127.0.0.1:" + jwksServer.getAddress().getPort() + "/jwks";
        validator = new JwtTokenValidator(ISSUER, AUDIENCE, jwksUri, true);
    }

    @AfterEach
    void stopJwksServer() {
        if (jwksServer != null) jwksServer.stop(0);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"Bearer", "ID", "Refresh", ""})
    void requiresKeycloakBearerAccessTokenType(String type) throws Exception {
        assertThat(validator.validateAndExtract(sign(initialKey, type), "org-a").isPresent())
                .isEqualTo("Bearer".equals(type));
    }

    @Test
    void acceptsReplacementKeyWithoutRestartingDecoder() throws Exception {
        var replacement = new RSAKeyGenerator(2048).keyID("replacement").generate();
        assertThat(validator.validateAndExtract(sign(initialKey, "Bearer"), "org-a")).isPresent();

        publishedKey.set(replacement.toPublicJWK());

        assertThat(validator.validateAndExtract(sign(replacement, "Bearer"), "org-a")).isPresent();
        assertThat(validator.validateAndExtract(sign(initialKey, "Bearer"), "org-a")).isEmpty();
    }

    @Test
    void usesCachedKeyDuringOutageAndRecoversWhenJwksReturns() throws Exception {
        var replacement = new RSAKeyGenerator(2048).keyID("replacement").generate();
        String currentToken = sign(initialKey, "Bearer");
        String replacementToken = sign(replacement, "Bearer");
        assertThat(validator.validateAndExtract(currentToken, "org-a")).isPresent();

        jwksAvailable.set(false);

        assertThat(validator.validateAndExtract(currentToken, "org-a")).isPresent();
        assertThat(validator.validateAndExtract(sign(initialKey, "Bearer", Instant.now().minusSeconds(60)), "org-a"))
                .isEmpty();
        assertThat(validator.validateAndExtract(replacementToken, "org-a")).isEmpty();

        publishedKey.set(replacement.toPublicJWK());
        jwksAvailable.set(true);

        assertThat(validator.validateAndExtract(replacementToken, "org-a")).isPresent();
    }

    private static String sign(RSAKey key, String type) throws Exception {
        return sign(key, type, Instant.now().plusSeconds(300));
    }

    private static String sign(RSAKey key, String type, Instant expiration) throws Exception {
        var claims = new JWTClaimsSet.Builder()
                .issuer(ISSUER)
                .audience(AUDIENCE)
                .subject("operator-a")
                .expirationTime(Date.from(expiration))
                .claim("typ", type)
                .build();
        var header = new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).build();
        var token = new SignedJWT(header, claims);
        token.sign(new RSASSASigner(key));
        return token.serialize();
    }
}
