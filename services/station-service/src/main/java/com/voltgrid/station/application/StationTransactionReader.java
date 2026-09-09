package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingTransaction;

import java.util.List;
import java.util.Optional;

public interface StationTransactionReader {

    Optional<ChargingTransaction> findById(
            String stationId,
            String transactionId
    );

    Optional<ChargingTransaction> findByIdForUpdate(
            String stationId,
            String transactionId
    );

    List<ChargingTransaction> findByStationId(
            String stationId
    );
}