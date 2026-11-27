package com.voltgrid.authorization;

import com.voltgrid.authorization.api.grpc.ServiceAuthenticationInterceptor;
import com.voltgrid.authorization.application.TokenFingerprintService;
import com.voltgrid.authorization.domain.AuthorizationTokenStatus;
import com.voltgrid.authorization.infrastructure.persistence.AuthorizationTokenEntity;
import com.voltgrid.authorization.infrastructure.persistence.AuthorizationTokenRepository;
import com.voltgrid.contracts.authorization.v1.AuthorizationDecision;
import com.voltgrid.contracts.authorization.v1.AuthorizationReason;
import com.voltgrid.contracts.authorization.v1.AuthorizationServiceGrpc;
import com.voltgrid.contracts.authorization.v1.AuthorizeRequest;
import io.grpc.ManagedChannel;
import io.grpc.Metadata;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import io.grpc.health.v1.HealthCheckRequest;
import io.grpc.health.v1.HealthCheckResponse;
import io.grpc.health.v1.HealthGrpc;
import io.grpc.netty.NettyChannelBuilder;
import io.grpc.stub.MetadataUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.grpc.test.autoconfigure.LocalGrpcServerPort;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(
        properties = {
                "spring.grpc.server.port=0",
                "voltgrid.authorization.active-key-version=v2",
                "voltgrid.authorization.legacy-keys.v1=legacy-test-hmac-key-at-least-32-bytes!!"
        }
)
@Import(PostgresTestConfiguration.class)
class AuthorizationGrpcIntegrationTests {

    @LocalGrpcServerPort
    private int port;

    @Value("${voltgrid.service-auth.service-keys.station-service}")
    private String stationServiceKey;

    @Autowired
    private AuthorizationTokenRepository repository;

    @Autowired
    private TokenFingerprintService fingerprintService;

    @BeforeEach
    void setUp() {
        repository.deleteAll();
    }

    @Test
    void shouldReportHealthyStatusOverGrpc() throws Exception {
        var channel = createChannel();
        try {
            var client = HealthGrpc.newBlockingStub(channel).withDeadlineAfter(5, TimeUnit.SECONDS);
            var response = client.check(HealthCheckRequest.getDefaultInstance());
            assertThat(response.getStatus()).isEqualTo(HealthCheckResponse.ServingStatus.SERVING);
        } finally {
            shutdown(channel);
        }
    }

    @Test
    void shouldAuthorizeActiveTokenOverGrpc() throws Exception {
        persistToken("RFID-123", AuthorizationTokenStatus.ACTIVE, null);

        var channel = createChannel();
        try {
            var client = authenticatedClient(channel);
            var request = AuthorizeRequest.newBuilder()
                    .setStationId("STATION-001")
                    .setIdToken("RFID-123")
                    .build();

            var response = client.authorize(request);
            assertThat(response.getDecision()).isEqualTo(AuthorizationDecision.AUTHORIZATION_DECISION_ACCEPTED);
            assertThat(response.getReason()).isEqualTo(AuthorizationReason.AUTHORIZATION_REASON_ALLOWED);
        } finally {
            shutdown(channel);
        }
    }

    @Test
    void shouldRejectUnknownTokenOverGrpc() throws Exception {
        var channel = createChannel();
        try {
            var client = authenticatedClient(channel);
            var request = AuthorizeRequest.newBuilder()
                    .setStationId("STATION-001")
                    .setIdToken("UNKNOWN")
                    .build();

            var response = client.authorize(request);
            assertThat(response.getDecision()).isEqualTo(AuthorizationDecision.AUTHORIZATION_DECISION_REJECTED);
            assertThat(response.getReason()).isEqualTo(AuthorizationReason.AUTHORIZATION_REASON_UNKNOWN_TOKEN);
        } finally {
            shutdown(channel);
        }
    }

    @Test
    void shouldRejectInactiveTokenOverGrpc() throws Exception {
        persistToken("BLOCKED-RFID", AuthorizationTokenStatus.BLOCKED, null);

        var channel = createChannel();
        try {
            var client = authenticatedClient(channel);
            var request = AuthorizeRequest.newBuilder()
                    .setStationId("STATION-001")
                    .setIdToken("BLOCKED-RFID")
                    .build();

            var response = client.authorize(request);
            assertThat(response.getDecision()).isEqualTo(AuthorizationDecision.AUTHORIZATION_DECISION_REJECTED);
            assertThat(response.getReason()).isEqualTo(AuthorizationReason.AUTHORIZATION_REASON_INACTIVE_TOKEN);
        } finally {
            shutdown(channel);
        }
    }

    @Test
    void shouldRejectExpiredTokenOverGrpc() throws Exception {
        persistToken("EXPIRED-RFID", AuthorizationTokenStatus.ACTIVE, Instant.now().minusSeconds(60));

        var channel = createChannel();
        try {
            var client = authenticatedClient(channel);
            var request = AuthorizeRequest.newBuilder()
                    .setStationId("STATION-001")
                    .setIdToken("EXPIRED-RFID")
                    .build();

            var response = client.authorize(request);
            assertThat(response.getDecision()).isEqualTo(AuthorizationDecision.AUTHORIZATION_DECISION_REJECTED);
            assertThat(response.getReason()).isEqualTo(AuthorizationReason.AUTHORIZATION_REASON_EXPIRED_TOKEN);
        } finally {
            shutdown(channel);
        }
    }

    @Test
    void shouldRejectEmptyTokenOverGrpc() throws Exception {
        var channel = createChannel();
        try {
            var client = authenticatedClient(channel);
            var request = AuthorizeRequest.newBuilder()
                    .setStationId("STATION-001")
                    .setIdToken("")
                    .build();

            var response = client.authorize(request);
            assertThat(response.getDecision()).isEqualTo(AuthorizationDecision.AUTHORIZATION_DECISION_REJECTED);
            assertThat(response.getReason()).isEqualTo(AuthorizationReason.AUTHORIZATION_REASON_UNKNOWN_TOKEN);
        } finally {
            shutdown(channel);
        }
    }

    @Test
    void shouldRejectUnauthenticatedCallMissingServiceHeadersOverGrpc() throws Exception {
        var channel = createChannel();
        try {
            var client = unauthenticatedClient(channel);
            var request = AuthorizeRequest.newBuilder()
                    .setStationId("STATION-001")
                    .setIdToken("ANY-TOKEN")
                    .build();

            assertThatThrownBy(() -> client.authorize(request))
                    .isInstanceOf(StatusRuntimeException.class)
                    .satisfies(ex -> assertThat(((StatusRuntimeException) ex).getStatus().getCode())
                            .isEqualTo(Status.Code.UNAUTHENTICATED));
        } finally {
            shutdown(channel);
        }
    }

    @Test
    void shouldRejectCallWithInvalidServiceKeyOverGrpc() throws Exception {
        var channel = createChannel();
        try {
            var client = customClient(channel, "station-service", "wrong-key-that-does-not-match-32-bytes!");
            var request = AuthorizeRequest.newBuilder()
                    .setStationId("STATION-001")
                    .setIdToken("ANY-TOKEN")
                    .build();

            assertThatThrownBy(() -> client.authorize(request))
                    .isInstanceOf(StatusRuntimeException.class)
                    .satisfies(ex -> assertThat(((StatusRuntimeException) ex).getStatus().getCode())
                            .isEqualTo(Status.Code.UNAUTHENTICATED));
        } finally {
            shutdown(channel);
        }
    }

    @Test
    void shouldRejectCallWithUnknownServiceIdOverGrpc() throws Exception {
        var channel = createChannel();
        try {
            var client = customClient(channel, "unauthorized-rogue-service", stationServiceKey);
            var request = AuthorizeRequest.newBuilder()
                    .setStationId("STATION-001")
                    .setIdToken("ANY-TOKEN")
                    .build();

            assertThatThrownBy(() -> client.authorize(request))
                    .isInstanceOf(StatusRuntimeException.class)
                    .satisfies(ex -> assertThat(((StatusRuntimeException) ex).getStatus().getCode())
                            .isEqualTo(Status.Code.UNAUTHENTICATED));
        } finally {
            shutdown(channel);
        }
    }

    @Test
    void shouldTransparentlyMigrateTokenAndAuthorizeOverGrpc() throws Exception {
        var rawToken = "MIGRATE-ME-OVER-GRPC-123";
        var v1Fingerprint = fingerprintService.fingerprint(rawToken, "v1");
        var entity = new AuthorizationTokenEntity(
                UUID.randomUUID(),
                v1Fingerprint,
                AuthorizationTokenStatus.ACTIVE,
                null,
                "v1",
                Instant.now(),
                Instant.now()
        );
        repository.saveAndFlush(entity);

        var channel = createChannel();
        try {
            var client = authenticatedClient(channel);
            var request = AuthorizeRequest.newBuilder()
                    .setStationId("STATION-001")
                    .setIdToken(rawToken)
                    .build();

            var response = client.authorize(request);
            assertThat(response.getDecision()).isEqualTo(AuthorizationDecision.AUTHORIZATION_DECISION_ACCEPTED);

            var updated = repository.findById(entity.getId()).orElseThrow();
            assertThat(updated.getKeyVersion()).isEqualTo("v2");
            assertThat(updated.getTokenFingerprint()).isEqualTo(fingerprintService.fingerprint(rawToken, "v2"));
        } finally {
            shutdown(channel);
        }
    }

    @Test
    void shouldRejectTokenHashedWithRetiredKeyOverGrpc() throws Exception {
        var entity = new AuthorizationTokenEntity(
                UUID.randomUUID(),
                "retired-key-fingerprint-deadbeef12345678",
                AuthorizationTokenStatus.ACTIVE,
                null,
                "v0",
                Instant.now(),
                Instant.now()
        );
        repository.saveAndFlush(entity);

        var channel = createChannel();
        try {
            var client = authenticatedClient(channel);
            var request = AuthorizeRequest.newBuilder()
                    .setStationId("STATION-001")
                    .setIdToken("RETIRED-KEY-TOKEN")
                    .build();

            var response = client.authorize(request);
            assertThat(response.getDecision()).isEqualTo(AuthorizationDecision.AUTHORIZATION_DECISION_REJECTED);
            assertThat(response.getReason()).isEqualTo(AuthorizationReason.AUTHORIZATION_REASON_UNKNOWN_TOKEN);
        } finally {
            shutdown(channel);
        }
    }

    private void persistToken(String rawToken, AuthorizationTokenStatus status, Instant expiresAt) {
        var now = Instant.now();
        repository.saveAndFlush(
                new AuthorizationTokenEntity(
                        UUID.randomUUID(),
                        fingerprintService.fingerprint(rawToken),
                        status,
                        expiresAt,
                        now,
                        now
                )
        );
    }

    private AuthorizationServiceGrpc.AuthorizationServiceBlockingStub unauthenticatedClient(ManagedChannel channel) {
        return AuthorizationServiceGrpc.newBlockingStub(channel);
    }

    private AuthorizationServiceGrpc.AuthorizationServiceBlockingStub customClient(
            ManagedChannel channel, String serviceId, String serviceKey
    ) {
        var metadata = new Metadata();
        if (serviceId != null) {
            metadata.put(ServiceAuthenticationInterceptor.SERVICE_ID_HEADER, serviceId);
        }
        if (serviceKey != null) {
            metadata.put(ServiceAuthenticationInterceptor.SERVICE_KEY_HEADER, serviceKey);
        }
        return AuthorizationServiceGrpc.newBlockingStub(channel)
                .withInterceptors(MetadataUtils.newAttachHeadersInterceptor(metadata));
    }

    private AuthorizationServiceGrpc.AuthorizationServiceBlockingStub authenticatedClient(ManagedChannel channel) {
        return customClient(channel, "station-service", stationServiceKey);
    }

    private ManagedChannel createChannel() {
        return NettyChannelBuilder.forAddress("localhost", port).usePlaintext().build();
    }

    private void shutdown(ManagedChannel channel) throws InterruptedException {
        channel.shutdown();
        if (!channel.awaitTermination(5, TimeUnit.SECONDS)) {
            channel.shutdownNow();
        }
    }
}
