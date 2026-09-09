package com.voltgrid.station.application;

import com.voltgrid.station.domain.TransactionEventType;

public class ConflictingTransactionEventException
        extends RuntimeException {

    public ConflictingTransactionEventException(
            int sequenceNumber,
            TransactionEventType existingType,
            TransactionEventType receivedType
    ) {
        super(
                "Transaction event sequence "
                        + sequenceNumber
                        + " was already received as "
                        + existingType
                        + ", received "
                        + receivedType
        );
    }
}