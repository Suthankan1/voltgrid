package com.voltgrid.station.domain;

public record TransactionEventReceipt(
        String stationId,
        String transactionId,
        int sequenceNumber,
        TransactionEventType eventType
) {
}