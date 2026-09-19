package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingTransaction;
import com.voltgrid.station.domain.TransactionCompleteness;

public record NetworkTransactionSnapshot(
        ChargingTransaction transaction,
        TransactionCompleteness completeness
) {
}