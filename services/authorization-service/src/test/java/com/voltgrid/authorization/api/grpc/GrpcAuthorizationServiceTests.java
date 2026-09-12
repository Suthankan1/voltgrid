package com.voltgrid.authorization.api.grpc;

import com.voltgrid.authorization.application.AuthorizationBackendUnavailableException;
import com.voltgrid.authorization.application.AuthorizationDecisionService;
import com.voltgrid.contracts.authorization.v1.AuthorizeRequest;
import com.voltgrid.contracts.authorization.v1.AuthorizeResponse;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GrpcAuthorizationServiceTests {

    @Mock
    private AuthorizationDecisionService authorizationDecisionService;

    @Mock
    private StreamObserver<AuthorizeResponse> responseObserver;

    private GrpcAuthorizationService grpcService;

    @BeforeEach
    void setUp() {
        grpcService =
                new GrpcAuthorizationService(
                        authorizationDecisionService
                );
    }

    @Test
    void shouldReturnUnavailableWhenAuthorizationBackendFails() {
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
                authorizationDecisionService.authorize(
                        "STATION-001",
                        "RFID-123"
                )
        ).thenThrow(
                new AuthorizationBackendUnavailableException(
                        "Authorization backend unavailable",
                        new RuntimeException(
                                "database failure"
                        )
                )
        );

        grpcService.authorize(
                request,
                responseObserver
        );

        var errorCaptor =
                ArgumentCaptor.forClass(
                        Throwable.class
                );

        verify(responseObserver)
                .onError(
                        errorCaptor.capture()
                );

        verify(responseObserver, never())
                .onNext(
                        org.mockito.ArgumentMatchers.any()
                );

        verify(responseObserver, never())
                .onCompleted();

        var status =
                Status.fromThrowable(
                        errorCaptor.getValue()
                );

        assertThat(status.getCode())
                .isEqualTo(
                        Status.Code.UNAVAILABLE
                );

        assertThat(status.getDescription())
                .isEqualTo(
                        "Authorization backend unavailable"
                );

        assertThat(
                status.getDescription()
        ).doesNotContain(
                "database failure"
        );
    }
}