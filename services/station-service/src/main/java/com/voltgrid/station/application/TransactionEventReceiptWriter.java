package com.voltgrid.station.application;

import com.voltgrid.station.domain.TransactionEventReceipt;

public interface TransactionEventReceiptWriter {

    void save(
            TransactionEventReceipt receipt
    );
}