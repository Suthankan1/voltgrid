package com.voltgrid.authorization.api.grpc;

import com.voltgrid.contracts.authorization.v1.AuthorizationDecision;
import com.voltgrid.contracts.authorization.v1.AuthorizationReason;
import com.voltgrid.contracts.authorization.v1.AuthorizationServiceGrpc;
import com.voltgrid.contracts.authorization.v1.AuthorizeRequest;
import com.voltgrid.contracts.authorization.v1.AuthorizeResponse;
import io.grpc.stub.StreamObserver;
import org.springframework.stereotype.Service;

@Service
public class GrpcAuthorizationService
        extends AuthorizationServiceGrpc.AuthorizationServiceImplBase {

    @Override
    public void authorize(
            AuthorizeRequest request,
            StreamObserver<AuthorizeResponse> responseObserver
    ) {
        var response = buildAuthorizationResponse(
                request
        );

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    private AuthorizeResponse buildAuthorizationResponse(
            AuthorizeRequest request
    ) {
        if (request.getIdToken().isBlank()) {
            return AuthorizeResponse.newBuilder()
                    .setDecision(
                            AuthorizationDecision
                                    .AUTHORIZATION_DECISION_REJECTED
                    )
                    .setReason(
                            AuthorizationReason
                                    .AUTHORIZATION_REASON_UNKNOWN_TOKEN
                    )
                    .build();
        }

        return AuthorizeResponse.newBuilder()
                .setDecision(
                        AuthorizationDecision
                                .AUTHORIZATION_DECISION_ACCEPTED
                )
                .setReason(
                        AuthorizationReason
                                .AUTHORIZATION_REASON_ALLOWED
                )
                .build();
    }
}