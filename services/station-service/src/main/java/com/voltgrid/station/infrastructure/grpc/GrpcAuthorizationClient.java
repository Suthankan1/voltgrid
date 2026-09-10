package com.voltgrid.station.infrastructure.grpc;

import com.voltgrid.contracts.authorization.v1.AuthorizationDecision;
import com.voltgrid.contracts.authorization.v1.AuthorizationServiceGrpc;
import com.voltgrid.contracts.authorization.v1.AuthorizeRequest;
import com.voltgrid.station.application.AuthorizationClient;
import com.voltgrid.station.application.AuthorizationOutcome;
import com.voltgrid.station.application.AuthorizationReasonCode;
import com.voltgrid.station.application.AuthorizationResult;
import org.springframework.stereotype.Component;

@Component
public class GrpcAuthorizationClient
        implements AuthorizationClient {

    private final AuthorizationServiceGrpc
            .AuthorizationServiceBlockingStub authorizationStub;

    public GrpcAuthorizationClient(
            AuthorizationServiceGrpc
                    .AuthorizationServiceBlockingStub authorizationStub
    ) {
        this.authorizationStub = authorizationStub;
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

        var response =
                authorizationStub.authorize(
                        request
                );

        return new AuthorizationResult(
                mapOutcome(
                        response.getDecision()
                ),
                mapReason(
                        response.getReason()
                )
        );
    }

    private AuthorizationOutcome mapOutcome(
            AuthorizationDecision decision
    ) {
        return switch (decision) {

            case AUTHORIZATION_DECISION_ACCEPTED ->
                    AuthorizationOutcome.ACCEPTED;

            case AUTHORIZATION_DECISION_REJECTED ->
                    AuthorizationOutcome.REJECTED;

            case AUTHORIZATION_DECISION_UNSPECIFIED,
                 UNRECOGNIZED ->
                    AuthorizationOutcome.REJECTED;
        };
    }

    private AuthorizationReasonCode mapReason(
            com.voltgrid.contracts.authorization.v1.AuthorizationReason reason
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

            case AUTHORIZATION_REASON_UNSPECIFIED,
                 UNRECOGNIZED ->
                    AuthorizationReasonCode.UNSPECIFIED;
        };
    }
}