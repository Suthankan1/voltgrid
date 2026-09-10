package com.voltgrid.authorization;

import com.voltgrid.contracts.authorization.v1.AuthorizationDecision;
import com.voltgrid.contracts.authorization.v1.AuthorizationReason;
import com.voltgrid.contracts.authorization.v1.AuthorizationServiceGrpc;
import com.voltgrid.contracts.authorization.v1.AuthorizeRequest;
import io.grpc.ManagedChannel;
import io.grpc.netty.NettyChannelBuilder;
import org.junit.jupiter.api.Test;
import org.springframework.boot.grpc.test.autoconfigure.LocalGrpcServerPort;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        properties = "spring.grpc.server.port=0"
)
class AuthorizationGrpcIntegrationTests {

    @LocalGrpcServerPort
    private int port;

    @Test
    void shouldAuthorizeNonEmptyTokenOverGrpc()
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