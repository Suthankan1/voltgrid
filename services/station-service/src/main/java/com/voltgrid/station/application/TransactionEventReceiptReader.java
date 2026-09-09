package com.voltgrid.station.application;

import com.voltgrid.station.domain.TransactionEventReceipt;

import java.util.List;
import java.util.Optional;

public interface TransactionEventReceiptReader {

    Optional<TransactionEventReceipt> findById(
            String stationId,
            String transactionId,
            int sequenceNumber
    );

    List<TransactionEventReceipt> findByTransaction(
            String stationId,
            String transactionId
    );
}