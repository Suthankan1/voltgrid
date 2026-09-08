package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingTransaction;

import java.util.Optional;

public interface StationTransactionReader {

    Optional<ChargingTransaction> findById(
            String stationId,
            String transactionId
    );
}