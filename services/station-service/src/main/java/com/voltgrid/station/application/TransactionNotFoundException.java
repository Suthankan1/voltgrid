package com.voltgrid.station.application;

public class TransactionNotFoundException
        extends RuntimeException {

    public TransactionNotFoundException(
            String stationId,
            String transactionId
    ) {
        super(
                "Transaction not found: "
                        + stationId
                        + "/"
                        + transactionId
        );
    }
}