package com.voltgrid.station.infrastructure.grpc;

import com.voltgrid.contracts.authorization.v1.AuthorizationDecision;
import com.voltgrid.contracts.authorization.v1.AuthorizationReason;
import com.voltgrid.contracts.authorization.v1.AuthorizationServiceGrpc;
import com.voltgrid.contracts.authorization.v1.AuthorizeRequest;
import com.voltgrid.contracts.authorization.v1.AuthorizeResponse;
import com.voltgrid.station.application.AuthorizationOutcome;
import com.voltgrid.station.application.AuthorizationReasonCode;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GrpcAuthorizationClientTests {

    private static final Duration DEADLINE =
            Duration.ofSeconds(1);

    @Mock
    private AuthorizationServiceGrpc
            .AuthorizationServiceBlockingStub authorizationStub;

    @Mock
    private AuthorizationServiceGrpc
            .AuthorizationServiceBlockingStub deadlineStub;

    private GrpcAuthorizationClient client;

    @BeforeEach
    void setUp() {
        when(
                authorizationStub.withDeadlineAfter(
                        DEADLINE.toMillis(),
                        TimeUnit.MILLISECONDS
                )
        ).thenReturn(
                deadlineStub
        );

        client =
                new GrpcAuthorizationClient(
                        authorizationStub,
                        DEADLINE
                );
    }

    @Test
    void shouldMapAcceptedAuthorizationResponse() {
        var request =
                AuthorizeRequest.newBuilder()
                        .setStationId(
                                "STATION-001"
                        )
                        .setIdToken(
                                "RFID-123"
                        )
                        .build();

        when(
                deadlineStub.authorize(
                        request
                )
        ).thenReturn(
                AuthorizeResponse.newBuilder()
                        .setDecision(
                                AuthorizationDecision
                                        .AUTHORIZATION_DECISION_ACCEPTED
                        )
                        .setReason(
                                AuthorizationReason
                                        .AUTHORIZATION_REASON_ALLOWED
                        )
                        .build()
        );

        var result =
                client.authorize(
                        "STATION-001",
                        "RFID-123"
                );

        assertThat(result.outcome())
                .isEqualTo(
                        AuthorizationOutcome.ACCEPTED
                );

        assertThat(result.reason())
                .isEqualTo(
                        AuthorizationReasonCode.ALLOWED
                );

        verify(
                authorizationStub
        ).withDeadlineAfter(
                DEADLINE.toMillis(),
                TimeUnit.MILLISECONDS
        );

        verify(deadlineStub)
                .authorize(request);
    }

    @Test
    void shouldMapRejectedAuthorizationResponse() {
        var request =
                AuthorizeRequest.newBuilder()
                        .setStationId(
                                "STATION-001"
                        )
                        .setIdToken(
                                "UNKNOWN"
                        )
                        .build();

        when(
                deadlineStub.authorize(
                        request
                )
        ).thenReturn(
                AuthorizeResponse.newBuilder()
                        .setDecision(
                                AuthorizationDecision
                                        .AUTHORIZATION_DECISION_REJECTED
                        )
                        .setReason(
                                AuthorizationReason
                                        .AUTHORIZATION_REASON_UNKNOWN_TOKEN
                        )
                        .build()
        );

        var result =
                client.authorize(
                        "STATION-001",
                        "UNKNOWN"
                );

        assertThat(result.outcome())
                .isEqualTo(
                        AuthorizationOutcome.REJECTED
                );

        assertThat(result.reason())
                .isEqualTo(
                        AuthorizationReasonCode.UNKNOWN_TOKEN
                );

        verify(
                authorizationStub
        ).withDeadlineAfter(
                DEADLINE.toMillis(),
                TimeUnit.MILLISECONDS
        );

        verify(deadlineStub)
                .authorize(request);
    }

    @Test
    void shouldFailClosedForUnspecifiedDecision() {
        var request =
                AuthorizeRequest.newBuilder()
                        .setStationId(
                                "STATION-001"
                        )
                        .setIdToken(
                                "RFID-123"
                        )
                        .build();

        when(
                deadlineStub.authorize(
                        request
                )
        ).thenReturn(
                AuthorizeResponse.newBuilder()
                        .setDecision(
                                AuthorizationDecision
                                        .AUTHORIZATION_DECISION_UNSPECIFIED
                        )
                        .setReason(
                                AuthorizationReason
                                        .AUTHORIZATION_REASON_UNSPECIFIED
                        )
                        .build()
        );

        var result =
                client.authorize(
                        "STATION-001",
                        "RFID-123"
                );

        assertThat(result.outcome())
                .isEqualTo(
                        AuthorizationOutcome.REJECTED
                );

        assertThat(result.reason())
                .isEqualTo(
                        AuthorizationReasonCode.UNSPECIFIED
                );

        verify(
                authorizationStub
        ).withDeadlineAfter(
                DEADLINE.toMillis(),
                TimeUnit.MILLISECONDS
        );

        verify(deadlineStub)
                .authorize(request);
    }

    @Test
    void shouldFailClosedWhenAuthorizationServiceIsUnavailable() {
        var request =
                AuthorizeRequest.newBuilder()
                        .setStationId(
                                "STATION-001"
                        )
                        .setIdToken(
                                "RFID-123"
                        )
                        .build();

        when(
                deadlineStub.authorize(
                        request
                )
        ).thenThrow(
                new StatusRuntimeException(
                        Status.UNAVAILABLE
                )
        );

        var result =
                client.authorize(
                        "STATION-001",
                        "RFID-123"
                );

        assertThat(result.outcome())
                .isEqualTo(
                        AuthorizationOutcome.REJECTED
                );

        assertThat(result.reason())
                .isEqualTo(
                        AuthorizationReasonCode.UNSPECIFIED
                );

        verify(
                authorizationStub
        ).withDeadlineAfter(
                DEADLINE.toMillis(),
                TimeUnit.MILLISECONDS
        );

        verify(deadlineStub)
                .authorize(request);
    }

    @Test
    void shouldFailClosedWhenAuthorizationDeadlineIsExceeded() {
        var request =
                AuthorizeRequest.newBuilder()
                        .setStationId(
                                "STATION-001"
                        )
                        .setIdToken(
                                "RFID-123"
                        )
                        .build();

        when(
                deadlineStub.authorize(
                        request
                )
        ).thenThrow(
                new StatusRuntimeException(
                        Status.DEADLINE_EXCEEDED
                )
        );

        var result =
                client.authorize(
                        "STATION-001",
                        "RFID-123"
                );

        assertThat(result.outcome())
                .isEqualTo(
                        AuthorizationOutcome.REJECTED
                );

        assertThat(result.reason())
                .isEqualTo(
                        AuthorizationReasonCode.UNSPECIFIED
                );

        verify(
                authorizationStub
        ).withDeadlineAfter(
                DEADLINE.toMillis(),
                TimeUnit.MILLISECONDS
        );

        verify(deadlineStub)
                .authorize(request);
    }
}