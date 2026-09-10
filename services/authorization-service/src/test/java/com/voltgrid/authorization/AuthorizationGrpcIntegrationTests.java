package com.voltgrid.authorization;

import com.voltgrid.authorization.application.TokenFingerprintService;
import com.voltgrid.authorization.domain.AuthorizationTokenStatus;
import com.voltgrid.authorization.infrastructure.persistence.AuthorizationTokenEntity;
import com.voltgrid.authorization.infrastructure.persistence.AuthorizationTokenRepository;
import com.voltgrid.contracts.authorization.v1.AuthorizationDecision;
import com.voltgrid.contracts.authorization.v1.AuthorizationReason;
import com.voltgrid.contracts.authorization.v1.AuthorizationServiceGrpc;
import com.voltgrid.contracts.authorization.v1.AuthorizeRequest;
import io.grpc.ManagedChannel;
import io.grpc.netty.NettyChannelBuilder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.grpc.test.autoconfigure.LocalGrpcServerPort;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        properties = "spring.grpc.server.port=0"
)
@Import(PostgresTestConfiguration.class)
class AuthorizationGrpcIntegrationTests {

    @LocalGrpcServerPort
    private int port;

    @Autowired
    private AuthorizationTokenRepository repository;

    @Autowired
    private TokenFingerprintService fingerprintService;

    @BeforeEach
    void setUp() {
        repository.deleteAll();
    }

    @Test
    void shouldAuthorizeActiveTokenOverGrpc()
            throws Exception {

        persistToken(
                "RFID-123",
                AuthorizationTokenStatus.ACTIVE,
                null
        );

        var channel = createChannel();

        try {
            var client =
                    AuthorizationServiceGrpc
                            .newBlockingStub(channel);

            var request =
                    AuthorizeRequest.newBuilder()
                            .setStationId(
                                    "STATION-001"
                            )
                            .setIdToken(
                                    "RFID-123"
                            )
                            .build();

            var response =
                    client.authorize(request);

            assertThat(
                    response.getDecision()
            ).isEqualTo(
                    AuthorizationDecision
                            .AUTHORIZATION_DECISION_ACCEPTED
            );

            assertThat(
                    response.getReason()
            ).isEqualTo(
                    AuthorizationReason
                            .AUTHORIZATION_REASON_ALLOWED
            );

        } finally {
            shutdown(channel);
        }
    }

    @Test
    void shouldRejectUnknownTokenOverGrpc()
            throws Exception {

        var channel = createChannel();

        try {
            var client =
                    AuthorizationServiceGrpc
                            .newBlockingStub(channel);

            var request =
                    AuthorizeRequest.newBuilder()
                            .setStationId(
                                    "STATION-001"
                            )
                            .setIdToken(
                                    "UNKNOWN"
                            )
                            .build();

            var response =
                    client.authorize(request);

            assertThat(
                    response.getDecision()
            ).isEqualTo(
                    AuthorizationDecision
                            .AUTHORIZATION_DECISION_REJECTED
            );

            assertThat(
                    response.getReason()
            ).isEqualTo(
                    AuthorizationReason
                            .AUTHORIZATION_REASON_UNKNOWN_TOKEN
            );

        } finally {
            shutdown(channel);
        }
    }

    @Test
    void shouldRejectBlockedTokenOverGrpc()
            throws Exception {

        persistToken(
                "BLOCKED-RFID",
                AuthorizationTokenStatus.BLOCKED,
                null
        );

        var channel = createChannel();

        try {
            var client =
                    AuthorizationServiceGrpc
                            .newBlockingStub(channel);

            var request =
                    AuthorizeRequest.newBuilder()
                            .setStationId(
                                    "STATION-001"
                            )
                            .setIdToken(
                                    "BLOCKED-RFID"
                            )
                            .build();

            var response =
                    client.authorize(request);

            assertThat(
                    response.getDecision()
            ).isEqualTo(
                    AuthorizationDecision
                            .AUTHORIZATION_DECISION_REJECTED
            );

            assertThat(
                    response.getReason()
            ).isEqualTo(
                    AuthorizationReason
                            .AUTHORIZATION_REASON_INACTIVE_TOKEN
            );

        } finally {
            shutdown(channel);
        }
    }

    @Test
    void shouldRejectExpiredTokenOverGrpc()
            throws Exception {

        persistToken(
                "EXPIRED-RFID",
                AuthorizationTokenStatus.ACTIVE,
                Instant.now()
                        .minusSeconds(60)
        );

        var channel = createChannel();

        try {
            var client =
                    AuthorizationServiceGrpc
                            .newBlockingStub(channel);

            var request =
                    AuthorizeRequest.newBuilder()
                            .setStationId(
                                    "STATION-001"
                            )
                            .setIdToken(
                                    "EXPIRED-RFID"
                            )
                            .build();

            var response =
                    client.authorize(request);

            assertThat(
                    response.getDecision()
            ).isEqualTo(
                    AuthorizationDecision
                            .AUTHORIZATION_DECISION_REJECTED
            );

            assertThat(
                    response.getReason()
            ).isEqualTo(
                    AuthorizationReason
                            .AUTHORIZATION_REASON_EXPIRED_TOKEN
            );

        } finally {
            shutdown(channel);
        }
    }

    @Test
    void shouldRejectEmptyTokenOverGrpc()
            throws Exception {

        var channel = createChannel();

        try {
            var client =
                    AuthorizationServiceGrpc
                            .newBlockingStub(channel);

            var request =
                    AuthorizeRequest.newBuilder()
                            .setStationId(
                                    "STATION-001"
                            )
                            .setIdToken("")
                            .build();

            var response =
                    client.authorize(request);

            assertThat(
                    response.getDecision()
            ).isEqualTo(
                    AuthorizationDecision
                            .AUTHORIZATION_DECISION_REJECTED
            );

            assertThat(
                    response.getReason()
            ).isEqualTo(
                    AuthorizationReason
                            .AUTHORIZATION_REASON_UNKNOWN_TOKEN
            );

        } finally {
            shutdown(channel);
        }
    }

    private void persistToken(
            String rawToken,
            AuthorizationTokenStatus status,
            Instant expiresAt
    ) {
        var now = Instant.now();

        repository.saveAndFlush(
                new AuthorizationTokenEntity(
                        UUID.randomUUID(),
                        fingerprintService.fingerprint(
                                rawToken
                        ),
                        status,
                        expiresAt,
                        now,
                        now
                )
        );
    }

    private ManagedChannel createChannel() {
        return NettyChannelBuilder
                .forAddress(
                        "localhost",
                        port
                )
                .usePlaintext()
                .build();
    }

    private void shutdown(
            ManagedChannel channel
    ) throws InterruptedException {

        channel.shutdown();

        if (!channel.awaitTermination(
                5,
                TimeUnit.SECONDS
        )) {
            channel.shutdownNow();
        }
    }
}