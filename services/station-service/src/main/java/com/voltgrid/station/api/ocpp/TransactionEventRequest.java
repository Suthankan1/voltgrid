package com.voltgrid.station.api.ocpp;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TransactionEventRequest(
        String eventType,
        String timestamp,
        String triggerReason,
        Integer seqNo,
        TransactionInfo transactionInfo,
        Evse evse
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TransactionInfo(
            String transactionId
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Evse(
            Integer id,
            Integer connectorId
    ) {
    }
}