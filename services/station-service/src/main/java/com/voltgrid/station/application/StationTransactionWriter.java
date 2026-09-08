package com.voltgrid.station.application;

import com.voltgrid.station.domain.ChargingTransaction;

public interface StationTransactionWriter {

    void save(ChargingTransaction transaction);
}