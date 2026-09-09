package com.voltgrid.station.application;

import com.voltgrid.station.domain.TransactionEventReceipt;

import java.util.List;

public interface TransactionEventReceiptReader {

    List<TransactionEventReceipt> findByTransaction(
            String stationId,
            String transactionId
    );
}