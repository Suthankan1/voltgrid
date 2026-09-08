package com.voltgrid.station.api.ocpp;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TransactionEventRequest(
        String eventType,
        List<MeterValue> meterValue,
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

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record MeterValue(
            List<SampledValue> sampledValue,
            String timestamp
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SampledValue(
            BigDecimal value,
            String context,
            String measurand,
            String phase,
            String location,
            UnitOfMeasure unitOfMeasure
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record UnitOfMeasure(
            String unit,
            Integer multiplier
    ) {
    }
}