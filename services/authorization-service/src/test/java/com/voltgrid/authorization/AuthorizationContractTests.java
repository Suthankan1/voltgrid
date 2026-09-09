package com.voltgrid.authorization;

import com.voltgrid.contracts.authorization.v1.AuthorizationDecision;
import com.voltgrid.contracts.authorization.v1.AuthorizationReason;
import com.voltgrid.contracts.authorization.v1.AuthorizeRequest;
import com.voltgrid.contracts.authorization.v1.AuthorizeResponse;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AuthorizationContractTests {

    @Test
    void shouldBuildAuthorizationRequestAndResponse() {
        var request =
                AuthorizeRequest.newBuilder()
                        .setStationId("STATION-001")
                        .setIdToken("RFID-123")
                        .build();

        var response =
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

        assertThat(request.getStationId())
                .isEqualTo("STATION-001");

        assertThat(request.getIdToken())
                .isEqualTo("RFID-123");

        assertThat(response.getDecision())
                .isEqualTo(
                        AuthorizationDecision
                                .AUTHORIZATION_DECISION_ACCEPTED
                );

        assertThat(response.getReason())
                .isEqualTo(
                        AuthorizationReason
                                .AUTHORIZATION_REASON_ALLOWED
                );
    }
}