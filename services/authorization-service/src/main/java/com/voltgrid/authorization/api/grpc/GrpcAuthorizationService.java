package com.voltgrid.authorization.api.grpc;

import com.voltgrid.authorization.application.AuthorizationBackendUnavailableException;
import com.voltgrid.authorization.application.AuthorizationDecisionService;
import com.voltgrid.contracts.authorization.v1.AuthorizationDecision;
import com.voltgrid.contracts.authorization.v1.AuthorizationReason;
import com.voltgrid.contracts.authorization.v1.AuthorizationServiceGrpc;
import com.voltgrid.contracts.authorization.v1.AuthorizeRequest;
import com.voltgrid.contracts.authorization.v1.AuthorizeResponse;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import org.springframework.stereotype.Service;

@Service
public class GrpcAuthorizationService
        extends AuthorizationServiceGrpc.AuthorizationServiceImplBase {

    private final AuthorizationDecisionService authorizationDecisionService;

    public GrpcAuthorizationService(
            AuthorizationDecisionService authorizationDecisionService
    ) {
        this.authorizationDecisionService =
                authorizationDecisionService;
    }

    @Override
    public void authorize(
            AuthorizeRequest request,
            StreamObserver<AuthorizeResponse> responseObserver
    ) {
        try {
            var response =
                    buildAuthorizationResponse(
                            request
                    );

            responseObserver.onNext(response);
            responseObserver.onCompleted();

        } catch (
                AuthorizationBackendUnavailableException exception
        ) {
            responseObserver.onError(
                    Status.UNAVAILABLE
                            .withDescription(
                                    "Authorization backend unavailable"
                            )
                            .asRuntimeException()
            );
        }
    }

    private AuthorizeResponse buildAuthorizationResponse(
            AuthorizeRequest request
    ) {
        if (request.getIdToken().isBlank()) {
            return rejected(
                    AuthorizationReason
                            .AUTHORIZATION_REASON_UNKNOWN_TOKEN
            );
        }

        var result =
                authorizationDecisionService.authorize(
                        request.getStationId(),
                        request.getIdToken()
                );

        return switch (result) {
            case ALLOWED ->
                    AuthorizeResponse.newBuilder()
                            .setDecision(
                                    AuthorizationDecision
                                            .AUTHORIZATION_DECISION_ACCEPTED
                            )
                            .setReason(
                                    AuthorizationReason
                                            .AUTHORIZATION_REASON_ALLOWED
                            )
                            .build();

            case UNKNOWN_TOKEN ->
                    rejected(
                            AuthorizationReason
                                    .AUTHORIZATION_REASON_UNKNOWN_TOKEN
                    );

            case BLOCKED_TOKEN ->
                    rejected(
                            AuthorizationReason
                                    .AUTHORIZATION_REASON_INACTIVE_TOKEN
                    );

            case EXPIRED_TOKEN ->
                    rejected(
                            AuthorizationReason
                                    .AUTHORIZATION_REASON_EXPIRED_TOKEN
                    );
        };
    }

    private AuthorizeResponse rejected(
            AuthorizationReason reason
    ) {
        return AuthorizeResponse.newBuilder()
                .setDecision(
                        AuthorizationDecision
                                .AUTHORIZATION_DECISION_REJECTED
                )
                .setReason(reason)
                .build();
    }
}