package com.voltgrid.station.application;

public class TransactionNotActiveException
        extends RuntimeException {

    public TransactionNotActiveException(
            String stationId,
            String transactionId
    ) {
        super(
                "Transaction is not active: "
                        + stationId
                        + "/"
                        + transactionId
        );
    }
}