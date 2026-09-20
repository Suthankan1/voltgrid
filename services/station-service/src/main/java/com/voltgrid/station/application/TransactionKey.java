package com.voltgrid.station.application;

public record TransactionKey(
        String stationId,
        String transactionId
) {
}