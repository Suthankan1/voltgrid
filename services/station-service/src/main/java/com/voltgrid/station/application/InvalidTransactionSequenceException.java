package com.voltgrid.station.application;

public class InvalidTransactionSequenceException
        extends RuntimeException {

    public InvalidTransactionSequenceException(
            int previousSequenceNumber,
            int receivedSequenceNumber
    ) {
        super(
                "Transaction sequence number must be greater than "
                        + previousSequenceNumber
                        + ", received "
                        + receivedSequenceNumber
        );
    }
}