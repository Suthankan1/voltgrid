package com.voltgrid.station.application;

import com.voltgrid.station.domain.TransactionDataStatus;

public record TransactionPageFilter(
        String stationId,
        String transactionId,
        TransactionDataStatus integrityStatus,
        String organizationId
) {

    public TransactionPageFilter {
        stationId = normalize(stationId);
        transactionId = normalize(transactionId);
        organizationId = normalize(organizationId);
    }

    public TransactionPageFilter(
            String stationId,
            String transactionId,
            TransactionDataStatus integrityStatus
    ) {
        this(stationId, transactionId, integrityStatus, null);
    }

    public TransactionPageFilter(
            String stationId,
            String transactionId
    ) {
        this(
                stationId,
                transactionId,
                null,
                null
        );
    }

    public static TransactionPageFilter empty() {
        return new TransactionPageFilter(
                null,
                null,
                null,
                null
        );
    }

    private static String normalize(
            String value
    ) {
        if (value == null) {
            return null;
        }

        var normalized = value.trim();

        return normalized.isEmpty()
                ? null
                : normalized;
    }
}
