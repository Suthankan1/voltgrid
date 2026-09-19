package com.voltgrid.station.api.graphql;

import com.voltgrid.station.application.NetworkTransactionSnapshot;

public record NetworkTransactionView(
        ChargingTransactionView transaction,
        TransactionCompletenessView completeness
) {

    public static NetworkTransactionView from(
            NetworkTransactionSnapshot snapshot
    ) {
        return new NetworkTransactionView(
                ChargingTransactionView.from(
                        snapshot.transaction()
                ),
                TransactionCompletenessView.from(
                        snapshot.completeness()
                )
        );
    }
}