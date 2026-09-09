package com.voltgrid.station.api.graphql;

import com.voltgrid.station.domain.TransactionCompleteness;
import com.voltgrid.station.domain.TransactionDataStatus;

import java.util.List;

public record TransactionCompletenessView(
        TransactionDataStatus status,
        Integer firstSequenceNumber,
        int lastSequenceNumber,
        List<Integer> missingSequenceNumbers
) {

    public static TransactionCompletenessView from(
            TransactionCompleteness completeness
    ) {
        return new TransactionCompletenessView(
                completeness.status(),
                completeness.firstSequenceNumber(),
                completeness.lastSequenceNumber(),
                completeness.missingSequenceNumbers()
        );
    }
}