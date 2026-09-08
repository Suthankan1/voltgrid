package com.voltgrid.station.domain;

import java.math.BigDecimal;
import java.time.Instant;

public record TransactionMeterSample(
        String stationId,
        String transactionId,
        int sequenceNumber,
        Instant sampledAt,
        BigDecimal value,
        String measurand,
        String context,
        String phase,
        String location,
        String unit,
        int unitMultiplier
) {
}