package com.voltgrid.station.application;

public record TransactionPageFilter(
        String stationId,
        String transactionId
) {

    public TransactionPageFilter {
        stationId = normalize(stationId);
        transactionId = normalize(transactionId);
    }

    public static TransactionPageFilter empty() {
        return new TransactionPageFilter(
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