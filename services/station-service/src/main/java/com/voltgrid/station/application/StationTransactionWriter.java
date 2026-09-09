package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingTransaction;

public interface StationTransactionWriter {

    boolean createIfAbsent(
            ChargingTransaction transaction
    );

    void save(
            ChargingTransaction transaction
    );
}