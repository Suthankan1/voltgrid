package com.voltgrid.station.domain;

import java.util.List;

public record TransactionCompleteness(
        String stationId,
        String transactionId,
        TransactionDataStatus status,
        Integer firstSequenceNumber,
        int lastSequenceNumber,
        List<Integer> missingSequenceNumbers
) {
}