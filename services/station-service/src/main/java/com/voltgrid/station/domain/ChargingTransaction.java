package com.voltgrid.station.domain;

import java.time.Instant;

public record ChargingTransaction(
        String stationId,
        String transactionId,
        int evseId,
        int connectorId,
        TransactionStatus status,
        Instant startedAt,
        Instant endedAt,
        int lastSequenceNumber
) {
}