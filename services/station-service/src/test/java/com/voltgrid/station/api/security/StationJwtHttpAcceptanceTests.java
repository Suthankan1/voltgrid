package com.voltgrid.station.api.security;

import com.voltgrid.station.support.PostgresTestConfiguration;
import com.voltgrid.station.domain.StationStatus;
import com.voltgrid.station.infrastructure.persistence.jpa.ChargingStationEntity;
import com.voltgrid.station.infrastructure.persistence.jpa.ChargingStationJpaRepository;
import com.voltgrid.station.infrastructure.persistence.jpa.OrganizationEntity;
import com.voltgrid.station.infrastructure.persistence.jpa.OrganizationJpaRepository;
import com.voltgrid.station.infrastructure.persistence.jpa.OrganizationMembershipEntity;
import com.voltgrid.station.infrastructure.persistence.jpa.OrganizationMembershipJpaRepository;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jose.util.Base64URL;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.PlainJWT;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "voltgrid.security.require-auth=true",
        "server.tomcat.threads.max=1",
        "server.tomcat.threads.min-spare=1",
        "debug=false",
        "management.otlp.metrics.export.enabled=false",
        "voltgrid.kafka.outbox.relay-enabled=false"
})
@Import({PostgresTestConfiguration.class, StationJwtHttpAcceptanceTests.RequestProbes.class})
@DirtiesContext
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@Execution(ExecutionMode.SAME_THREAD)
class StationJwtHttpAcceptanceTests {

    private static final String ISSUER = "https://issuer.example.test/realms/http-acceptance";
    private static final String AUDIENCE = "voltgrid-http-acceptance";
    private static final String SUBJECT = "jwt-http-operator";
    private static final String ORG = "jwt-http-org";
    private static final String RESOURCE = "jwt-http-station";
    private static final String QUERY =
            "{\"query\": \"{ station(id: \\\"jwt-http-station\\\", organizationId: \\\"jwt-http-org\\\") { id name } }\"}";
    private static HttpServer issuerServer;
    private static RSAKey trusted;
    private static RSAKey untrusted;
    private static final AtomicInteger alternateKeyRequests = new AtomicInteger();
    private static final AtomicInteger downstreamRequests = new AtomicInteger();
    private static final BlockingQueue<Boolean> clearedContexts = new LinkedBlockingQueue<>();
    private static final JsonMapper JSON = JsonMapper.builder().build();

    @LocalServerPort
    private int port;

    private final HttpClient client = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    @DynamicPropertySource
    static void configureIssuer(DynamicPropertyRegistry registry) throws Exception {
        trusted = new RSAKeyGenerator(2048).keyID("trusted").generate();
        untrusted = new RSAKeyGenerator(2048).keyID("untrusted").generate();
        issuerServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        publish("/jwks", trusted);
        publish("/alternate-jwks", untrusted);
        issuerServer.start();
        registry.add("voltgrid.security.jwt.issuer", () -> ISSUER);
        registry.add("voltgrid.security.jwt.audience", () -> AUDIENCE);
        registry.add("voltgrid.security.jwt.jwk-set-uri", () -> issuerUri("/jwks"));
    }

    private static void publish(String path, RSAKey key) {
        byte[] body = new JWKSet(key.toPublicJWK()).toString().getBytes(StandardCharsets.UTF_8);
        issuerServer.createContext(path, exchange -> {
            try (exchange) {
                if (path.equals("/alternate-jwks")) {
                    alternateKeyRequests.incrementAndGet();
                }
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
            }
        });
    }

    private static String issuerUri(String path) {
        return "http://127.0.0.1:" + issuerServer.getAddress().getPort() + path;
    }

    @AfterAll
    void closeFixtures() {
        client.close();
        if (issuerServer != null) {
            issuerServer.stop(0);
        }
    }

    @BeforeAll
    void seed(@Autowired OrganizationJpaRepository organizations, @Autowired OrganizationMembershipJpaRepository memberships,
              @Autowired ChargingStationJpaRepository stations) {
        organizations.save(new OrganizationEntity(ORG, "JWT acceptance", "ACTIVE"));
        memberships.save(new OrganizationMembershipEntity(
                "jwt-http-member", ORG, SUBJECT, "operator@example.test", "OPERATOR", "ACTIVE"));
        stations.save(new ChargingStationEntity(RESOURCE, "JWT acceptance station", StationStatus.ONLINE,
                null, ORG, null));
    }

    @Test
    void jwt01ValidRs256ReturnsProtectedData() throws Exception {
        assertAuthorized(signed(claims().build()));
    }

    @ParameterizedTest(name = "{0}")
    @EnumSource(Rejection.class)
    void jwt02Through24RejectAtAuthenticationBoundary(Rejection rejection) throws Exception {
        assertRejected(rejection.header(), rejection.reason);
        assertThat(alternateKeyRequests.get()).isZero();
    }

    @Test
    void jwt25And26IsolateConsecutiveRequests() throws Exception {
        String valid = signed(claims().build());
        assertAuthorized(valid);
        assertRejected(null, "MISSING_BEARER_TOKEN");
        assertRejected("Bearer invalid-token", "INVALID_BEARER_TOKEN");
        assertAuthorized(valid);
    }

    @Test
    void acceptsTimestampClaimsWithinConfiguredSkew() throws Exception {
        Instant now = Instant.now();
        assertAuthorized(signed(claims().expirationTime(Date.from(now.minusSeconds(5))).build()));
        assertAuthorized(signed(claims().notBeforeTime(Date.from(Instant.now().plusSeconds(15))).build()));
    }

    @Test
    void signedTokensScopeAliasedReadsAndHonorMembershipChangesOnTheNextRequest(
            @Autowired OrganizationJpaRepository organizations,
            @Autowired OrganizationMembershipJpaRepository memberships,
            @Autowired ChargingStationJpaRepository stations
    ) throws Exception {
        String orgA = "membership-org-a";
        String orgB = "membership-org-b";
        String owner = "membership-owner";
        String operator = "membership-admin";
        organizations.save(new OrganizationEntity(orgA, "Organization A", "ACTIVE"));
        organizations.save(new OrganizationEntity(orgB, "Organization B", "ACTIVE"));
        memberships.save(new OrganizationMembershipEntity(
                "membership-a-owner", orgA, owner, "owner@example.test", "ORG_OWNER", "ACTIVE"));
        memberships.save(new OrganizationMembershipEntity(
                "membership-a-admin", orgA, operator, "admin@example.test", "ORG_ADMIN", "ACTIVE"));
        memberships.save(new OrganizationMembershipEntity(
                "membership-b-owner", orgB, operator, "admin@example.test", "ORG_OWNER", "ACTIVE"));
        stations.save(new ChargingStationEntity("membership-station-a", "Station A",
                StationStatus.ONLINE, null, orgA, null));
        stations.save(new ChargingStationEntity("membership-station-b", "Station B",
                StationStatus.ONLINE, null, orgB, null));

        String ownerToken = signed(claims().subject(owner).claim("org_id", orgA).build());
        String operatorToken = signed(claims().subject(operator).claim("org_id", orgA).build());
        String readA = """
                {
                    own: station(id: "membership-station-a", organizationId: "membership-org-a") { id }
                    foreign: station(id: "membership-station-b", organizationId: "membership-org-a") { id }
                }
                """;
        var scoped = graphQl(operatorToken, readA);
        assertThat(scoped.has("errors")).isFalse();
        assertThat(scoped.at("/data/own/id").asString()).isEqualTo("membership-station-a");
        assertThat(scoped.at("/data/foreign").isNull()).isTrue();
        var deniedForeignOrg = graphQl(ownerToken, """
                { station(id: "membership-station-b", organizationId: "membership-org-b") { id } }
                """);
        assertThat(deniedForeignOrg.has("errors")).isTrue();
        assertThat(deniedForeignOrg.at("/data/station").isNull()).isTrue();

        var allowedWrite = graphQl(operatorToken, """
                mutation {
                    createSite(input: {id: "membership-site-a", organizationId: "membership-org-a", name: "Site A"}) { id }
                }
                """);
        assertThat(allowedWrite.at("/data/createSite/id").asString()).isEqualTo("membership-site-a");

        var downgrade = graphQl(ownerToken, """
                mutation {
                    updateMemberRole(organizationId: "membership-org-a", userId: "membership-admin", role: "SUPPORT") { role }
                }
                """);
        assertThat(downgrade.at("/data/updateMemberRole/role").asString()).isEqualTo("SUPPORT");
        var deniedWrite = graphQl(operatorToken, """
                mutation {
                    createSite(input: {id: "membership-site-denied", organizationId: "membership-org-a", name: "Denied"}) { id }
                }
                """);
        assertThat(deniedWrite.has("errors")).isTrue();
        var stillReadable = graphQl(operatorToken, readA);
        assertThat(stillReadable.at("/data/own/id").asString()).isEqualTo("membership-station-a");

        var selfEscalation = graphQl(operatorToken, """
                mutation {
                    updateMemberRole(organizationId: "membership-org-a", userId: "membership-admin", role: "ORG_OWNER") { role }
                }
                """);
        assertThat(selfEscalation.has("errors")).isTrue();
        var revoked = graphQl(ownerToken, """
                mutation {
                    revokeMember(organizationId: "membership-org-a", userId: "membership-admin")
                }
                """);
        assertThat(revoked.at("/data/revokeMember").asBoolean()).isTrue();
        var deniedRead = graphQl(operatorToken, readA);
        assertThat(deniedRead.has("errors")).isTrue();
        assertThat(deniedRead.at("/data/own").isNull()).isTrue();

        var stillAllowedInB = graphQl(operatorToken, """
                { station(id: "membership-station-b", organizationId: "membership-org-b") { id } }
                """);
        assertThat(stillAllowedInB.at("/data/station/id").asString()).isEqualTo("membership-station-b");

        var sites = graphQl(ownerToken, "{ sites(organizationId: \"membership-org-a\") { id } }");
        assertThat(sites.at("/data/sites").size()).isEqualTo(1);
        assertThat(sites.at("/data/sites/0/id").asString()).isEqualTo("membership-site-a");
        var audit = graphQl(ownerToken, """
                { administrativeAuditEvents(organizationId: "membership-org-a") { content { eventType actorId } } }
                """);
        assertThat(audit.has("errors")).isFalse();
        assertThat(audit.at("/data/administrativeAuditEvents/content").valueStream()
                .filter(event -> event.path("actorId").asString().equals(owner))
                .map(event -> event.path("eventType").asString()))
                .containsExactlyInAnyOrder("MEMBERSHIP_ROLE_UPDATED", "MEMBERSHIP_REVOKED");
    }

    private JsonNode graphQl(String token, String query) throws Exception {
        var response = request("Bearer " + token, JSON.writeValueAsString(Map.of("query", query)));
        assertThat(response.statusCode()).isEqualTo(200);
        return JSON.readTree(response.body());
    }

    private void assertAuthorized(String token) throws Exception {
        int downstreamBefore = downstreamRequests.get();
        var response = request("Bearer " + token);
        assertThat(response.statusCode()).isEqualTo(200);
        var body = JSON.readTree(response.body());
        assertThat(body.has("errors")).as("GraphQL response: %s", body).isFalse();
        assertThat(body.at("/data/station/id").asString()).isEqualTo(RESOURCE);
        assertThat(body.at("/data/station/name").asString()).isEqualTo("JWT acceptance station");
        assertThat(downstreamRequests.get()).isEqualTo(downstreamBefore + 1);
    }

    private void assertRejected(String authorization, String reason) throws Exception {
        int downstreamBefore = downstreamRequests.get();
        var response = request(authorization);
        assertThat(response.statusCode()).isEqualTo(401);
        assertThat(response.headers().firstValue("Content-Type")).hasValueSatisfying(
                value -> assertThat(value).startsWith("application/json"));
        String message = reason.equals("MISSING_BEARER_TOKEN")
                ? "Authentication required: missing Bearer token" : "Invalid or expired Bearer token";
        // Exact equality also rules out protected data and token contents in the response.
        assertThat(JSON.readTree(response.body())).isEqualTo(JSON.readTree("""
                {"errors":[{"message":"%s","extensions":{"code":"UNAUTHORIZED","reason":"%s"}}]}
                """.formatted(message, reason)));
        assertThat(downstreamRequests.get()).isEqualTo(downstreamBefore);
    }

    private HttpResponse<String> request(String authorization) throws Exception {
        return request(authorization, QUERY);
    }

    private HttpResponse<String> request(String authorization, String body) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/graphql"))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body));
        if (authorization != null) {
            builder.header("Authorization", authorization);
        }
        var response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        assertThat(clearedContexts.poll(5, TimeUnit.SECONDS))
                .as("servlet thread has no identity before or after the production filter").isTrue();
        return response;
    }

    private static JWTClaimsSet.Builder claims() {
        return new JWTClaimsSet.Builder().issuer(ISSUER).audience(AUDIENCE).subject(SUBJECT)
                .expirationTime(Date.from(Instant.now().plusSeconds(300)))
                .claim("typ", "Bearer").claim("org_id", ORG);
    }

    private static String signed(JWTClaimsSet claims) throws Exception {
        return signed(claims, new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("trusted").build(), trusted);
    }

    private static String signed(JWTClaimsSet claims, JWSHeader header, RSAKey key) throws Exception {
        var token = new SignedJWT(header, claims);
        token.sign(new RSASSASigner(key));
        return token.serialize();
    }

    enum Rejection {
        JWT_02_MISSING_HEADER("MISSING_BEARER_TOKEN"),
        JWT_03_EMPTY_CREDENTIAL("MISSING_BEARER_TOKEN"),
        JWT_04_MALFORMED,
        JWT_05_BAD_SIGNATURE,
        JWT_06_MODIFIED_PAYLOAD,
        JWT_07_UNSIGNED,
        JWT_08_UNTRUSTED_KEY,
        JWT_09_WRONG_ISSUER,
        JWT_10_MISSING_ISSUER,
        JWT_11_WRONG_AUDIENCE,
        JWT_12_MISSING_AUDIENCE,
        JWT_13_EXPIRED,
        JWT_14_MISSING_EXPIRATION,
        JWT_15_PREMATURE,
        JWT_16_MISSING_SUBJECT,
        JWT_17_BLANK_SUBJECT,
        JWT_18_HS256,
        JWT_19_RS512,
        JWT_20_UNKNOWN_KEY_ID,
        JWT_21_ID_TOKEN,
        JWT_22_REFRESH_TOKEN,
        JWT_23_MISSING_TOKEN_TYPE,
        JWT_24_HISTORICAL_DEV_TOKEN;

        private final String reason;

        Rejection() {
            this("INVALID_BEARER_TOKEN");
        }

        Rejection(String reason) {
            this.reason = reason;
        }

        String header() throws Exception {
            var valid = claims();
            return switch (this) {
                case JWT_02_MISSING_HEADER -> null;
                case JWT_03_EMPTY_CREDENTIAL -> "Bearer ";
                case JWT_04_MALFORMED -> bearer("invalid-token");
                case JWT_05_BAD_SIGNATURE -> bearer(signed(valid.build(),
                        new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("trusted").build(), untrusted));
                case JWT_06_MODIFIED_PAYLOAD -> {
                    var original = SignedJWT.parse(signed(valid.build()));
                    var modified = new JWTClaimsSet.Builder(original.getJWTClaimsSet())
                            .claim("email", "changed@example.test").build();
                    yield bearer(original.getHeader().toBase64URL() + "."
                            + Base64URL.encode(modified.toString()) + "." + original.getSignature());
                }
                case JWT_07_UNSIGNED -> bearer(new PlainJWT(valid.build()).serialize());
                case JWT_08_UNTRUSTED_KEY -> bearer(signed(valid.build(),
                        new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("untrusted")
                                .jwkURL(URI.create(issuerUri("/alternate-jwks")))
                                .jwk(untrusted.toPublicJWK()).build(), untrusted));
                case JWT_09_WRONG_ISSUER -> bearer(signed(valid.issuer("https://wrong.example.test").build()));
                case JWT_10_MISSING_ISSUER -> bearer(signed(valid.issuer(null).build()));
                case JWT_11_WRONG_AUDIENCE -> bearer(signed(valid.audience("wrong-api").build()));
                case JWT_12_MISSING_AUDIENCE -> bearer(signed(valid.audience((String) null).build()));
                case JWT_13_EXPIRED -> bearer(signed(valid.expirationTime(Date.from(Instant.now().minusSeconds(120))).build()));
                case JWT_14_MISSING_EXPIRATION -> bearer(signed(valid.expirationTime(null).build()));
                case JWT_15_PREMATURE -> bearer(signed(valid.notBeforeTime(Date.from(Instant.now().plusSeconds(120))).build()));
                case JWT_16_MISSING_SUBJECT -> bearer(signed(valid.subject(null).build()));
                case JWT_17_BLANK_SUBJECT -> bearer(signed(valid.subject(" ").build()));
                case JWT_18_HS256 -> {
                    byte[] key = new byte[32];
                    new SecureRandom().nextBytes(key);
                    var token = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.HS256).keyID("trusted").build(),
                            valid.build());
                    token.sign(new MACSigner(key));
                    yield bearer(token.serialize());
                }
                case JWT_19_RS512 -> bearer(signed(valid.build(),
                        new JWSHeader.Builder(JWSAlgorithm.RS512).keyID("trusted").build(), trusted));
                case JWT_20_UNKNOWN_KEY_ID -> bearer(signed(valid.build(),
                        new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("unknown").build(), trusted));
                case JWT_21_ID_TOKEN -> bearer(signed(valid.claim("typ", "ID").build()));
                case JWT_22_REFRESH_TOKEN -> bearer(signed(valid.claim("typ", "Refresh").build()));
                case JWT_23_MISSING_TOKEN_TYPE -> bearer(signed(valid.claim("typ", null).build()));
                case JWT_24_HISTORICAL_DEV_TOKEN -> bearer("voltgrid-dev-token");
            };
        }

        private static String bearer(String token) {
            return "Bearer " + token;
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class RequestProbes {

        @Bean
        FilterRegistrationBean<jakarta.servlet.Filter> contextProbe() {
            var registration = new FilterRegistrationBean<jakarta.servlet.Filter>((request, response, chain) -> {
                boolean anonymousOnEntry = SecurityContext.get() == null;
                try {
                    chain.doFilter(request, response);
                } finally {
                    clearedContexts.add(anonymousOnEntry && SecurityContext.get() == null);
                }
            });
            registration.setOrder(0);
            registration.addUrlPatterns("/graphql");
            return registration;
        }

        @Bean
        FilterRegistrationBean<jakarta.servlet.Filter> downstreamProbe() {
            var registration = new FilterRegistrationBean<jakarta.servlet.Filter>((request, response, chain) -> {
                downstreamRequests.incrementAndGet();
                chain.doFilter(request, response);
            });
            registration.setOrder(2);
            registration.addUrlPatterns("/graphql");
            return registration;
        }

    }
}
