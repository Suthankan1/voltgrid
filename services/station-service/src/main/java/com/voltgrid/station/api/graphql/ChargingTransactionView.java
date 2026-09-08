package com.voltgrid.station.api.graphql;

import com.voltgrid.station.domain.ChargingTransaction;
import com.voltgrid.station.domain.TransactionStatus;

public record ChargingTransactionView(
        String stationId,
        String transactionId,
        int evseId,
        int connectorId,
        TransactionStatus status,
        String startedAt,
        String endedAt,
        int lastSequenceNumber
) {

    public static ChargingTransactionView from(
            ChargingTransaction transaction
    ) {
        return new ChargingTransactionView(
                transaction.stationId(),
                transaction.transactionId(),
                transaction.evseId(),
                transaction.connectorId(),
                transaction.status(),
                transaction.startedAt().toString(),
                transaction.endedAt() == null
                        ? null
                        : transaction.endedAt().toString(),
                transaction.lastSequenceNumber()
        );
    }
}