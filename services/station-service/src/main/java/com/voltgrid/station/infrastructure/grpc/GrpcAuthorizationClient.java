package com.voltgrid.station.infrastructure.grpc;

import com.voltgrid.contracts.authorization.v1.AuthorizationDecision;
import com.voltgrid.contracts.authorization.v1.AuthorizationReason;
import com.voltgrid.contracts.authorization.v1.AuthorizationServiceGrpc;
import com.voltgrid.contracts.authorization.v1.AuthorizeRequest;
import com.voltgrid.station.application.AuthorizationClient;
import com.voltgrid.station.application.AuthorizationOutcome;
import com.voltgrid.station.application.AuthorizationReasonCode;
import com.voltgrid.station.application.AuthorizationResult;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

@Component
public class GrpcAuthorizationClient
        implements AuthorizationClient {

    private final AuthorizationServiceGrpc.AuthorizationServiceBlockingStub stub;
    private final Duration deadline;

    public GrpcAuthorizationClient(
            AuthorizationServiceGrpc.AuthorizationServiceBlockingStub stub,
            @Value("${voltgrid.authorization.grpc-deadline:1s}")
            Duration deadline
    ) {
        this.stub = stub;
        this.deadline = deadline;
    }

    @Override
    public AuthorizationResult authorize(
            String stationId,
            String idToken
    ) {
        var request =
                AuthorizeRequest.newBuilder()
                        .setStationId(stationId)
                        .setIdToken(idToken)
                        .build();

        try {
            var response =
                    stub.withDeadlineAfter(
                                    deadline.toMillis(),
                                    TimeUnit.MILLISECONDS
                            )
                            .authorize(request);

            return new AuthorizationResult(
                    mapDecision(
                            response.getDecision()
                    ),
                    mapReason(
                            response.getReason()
                    )
            );

        } catch (StatusRuntimeException exception) {
            return handleGrpcFailure(exception);
        }
    }

    private AuthorizationResult handleGrpcFailure(
            StatusRuntimeException exception
    ) {
        var status = exception.getStatus();

        if (status.getCode()
                == Status.Code.DEADLINE_EXCEEDED
                || status.getCode()
                == Status.Code.UNAVAILABLE) {

            return failClosed();
        }

        return failClosed();
    }

    private AuthorizationResult failClosed() {
        return new AuthorizationResult(
                AuthorizationOutcome.REJECTED,
                AuthorizationReasonCode.UNSPECIFIED
        );
    }

    private AuthorizationOutcome mapDecision(
            AuthorizationDecision decision
    ) {
        return switch (decision) {
            case AUTHORIZATION_DECISION_ACCEPTED ->
                    AuthorizationOutcome.ACCEPTED;

            case AUTHORIZATION_DECISION_REJECTED,
                 AUTHORIZATION_DECISION_UNSPECIFIED,
                 UNRECOGNIZED ->
                    AuthorizationOutcome.REJECTED;
        };
    }

    private AuthorizationReasonCode mapReason(
            AuthorizationReason reason
    ) {
        return switch (reason) {
            case AUTHORIZATION_REASON_ALLOWED ->
                    AuthorizationReasonCode.ALLOWED;

            case AUTHORIZATION_REASON_UNKNOWN_TOKEN ->
                    AuthorizationReasonCode.UNKNOWN_TOKEN;

            case AUTHORIZATION_REASON_INACTIVE_TOKEN ->
                    AuthorizationReasonCode.INACTIVE_TOKEN;

            case AUTHORIZATION_REASON_STATION_NOT_ALLOWED ->
                    AuthorizationReasonCode.STATION_NOT_ALLOWED;

            case AUTHORIZATION_REASON_EXPIRED_TOKEN ->
                    AuthorizationReasonCode.EXPIRED_TOKEN;

            case AUTHORIZATION_REASON_UNSPECIFIED,
                 UNRECOGNIZED ->
                    AuthorizationReasonCode.UNSPECIFIED;
        };
    }
}